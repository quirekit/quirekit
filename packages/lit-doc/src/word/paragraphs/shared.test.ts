import { expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { paragraphBoundaryStreams, tableBoundaryDocument } from '../../testing/tables/boundaries'
import type { DocReadDiagnostic } from '../../types'
import { readWordHeader } from '../fib'
import { readTextStorage } from '../pieces'
import { createFormattingContext } from '../formatting/context'
import { readTableRoles } from '../tables/roles'
import { readParagraphFormats } from './formatting/read'
import { readParagraphRecords } from './read'
import { inspectDoc } from '../../inspection'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'
import { operation, withPiecePropertyGroup } from '../../testing/formatting'
import { createPropertyReader } from '../properties/reader'

it.each(['nested-cell', 'row-end', 'missing'] as const)('matches original PAPX interval boundaries %s', kind => {
  const source = paragraphBoundaryStreams(kind), limits = resolveLimits({})
  const header = readWordHeader(source.WordDocument!, limits)
  const storage = readTextStorage(source.WordDocument!, source['1Table']!, header, limits)
  const diagnostics: DocReadDiagnostic[] = []
  const paragraphs = readParagraphRecords(source.WordDocument!, source['1Table']!, header, storage, limits,
    undefined, undefined, diagnostics).slice(0, 2)
  expect(paragraphs.map(paragraph => [paragraph.start, paragraph.end])).toEqual([[0, 2], [2, kind === 'missing' ? 4 : 3]])
  const context = createFormattingContext(source['1Table']!, undefined, header, limits, false)
  const formats = readParagraphFormats(storage, paragraphs, context, limits)
  const roles = readTableRoles(paragraphs, storage, context.reader, limits, header.version)
  if (kind === 'nested-cell') {
    expect(roles.map(role => [role.level, role.role])).toEqual([[2, 'paragraph'], [2, 'cell']])
  } else if (kind === 'row-end') {
    expect(roles.map(role => [role.level, role.role])).toEqual([[1, 'paragraph'], [1, 'row']])
    expect(formats.map(format => format.alignment.value)).toEqual([1, 1])
  } else {
    expect(formats.map(format => format.alignment.value)).toEqual([0, 1])
    expect(paragraphs[0]!.formatting).toMatchObject({ defaulted: true, styleIndex: 0 })
    expect(paragraphs[0]!.endsFormattingRecord).toBe(false)
    expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual(['paragraph-properties-defaulted'])
    expect(() => readParagraphRecords(source.WordDocument!, source['1Table']!, header, storage, limits))
      .toThrow(expect.objectContaining({ code: 'invalid-paragraph-data' }))
  }
})

it.each(['nested-cell', 'row-end'] as const)('keeps complete source topology for shared PAPX %s', kind => {
  const result = inspectDoc(tableBoundaryDocument(kind), { includeTables: true })
  expect(result.tables?.map(table => ({ level: table.level, cells: table.rows.map(row => row.cells.length) })))
    .toEqual(kind === 'nested-cell' ? [{ level: 1, cells: [1] }, { level: 2, cells: [1] }] : [{ level: 1, cells: [1] }])
})

it.each(['index-split', 'page-split', 'index-start-split', 'page-start-split', 'bad-page'] as const)('keeps %s errors outside absent-PAPX defaults', kind => {
  const streams = withParagraphRecords(wordStreams([{ units: [65, 13, 66, 13], unicode: true }]), [{ cuts: [2048, 2056] }])
  const limits = resolveLimits({}), header = readWordHeader(streams.WordDocument!, limits)
  const table = new DataView(streams['1Table']!.buffer), range = header.records[13]!
  const page = table.getUint32(range.offset + 8, true) * 512
  if (kind === 'index-split') table.setUint32(range.offset + 4, 2051, true)
  if (kind === 'page-split') new DataView(streams.WordDocument!.buffer).setUint32(page + 4, 2051, true)
  if (kind === 'index-start-split') table.setUint32(range.offset, 2051, true)
  if (kind === 'page-start-split') new DataView(streams.WordDocument!.buffer).setUint32(page, 2051, true)
  if (kind === 'bad-page') streams.WordDocument![page + 511] = 0
  const storage = readTextStorage(streams.WordDocument!, streams['1Table']!, header, limits)
  expect(() => readParagraphRecords(streams.WordDocument!, streams['1Table']!, header, storage, limits, undefined, undefined, []))
    .toThrow(expect.objectContaining({ code: 'invalid-paragraph-data' }))
})

it('defaults a genuine page gap without mutating source bytes or consuming a false endpoint', () => {
  const streams = paragraphBoundaryStreams('missing'), limits = resolveLimits({})
  const header = readWordHeader(streams.WordDocument!, limits)
  new DataView(streams['1Table']!.buffer).setUint32(header.records[13]!.offset, 2048, true)
  const before = Object.fromEntries(Object.entries(streams).map(([name, bytes]) => [name, bytes.slice()]))
  const storage = readTextStorage(streams.WordDocument!, streams['1Table']!, header, limits)
  for (let index = 0; index < 2; index++) {
    const diagnostics: DocReadDiagnostic[] = []
    const records = readParagraphRecords(streams.WordDocument!, streams['1Table']!, header, storage, limits, undefined, undefined, diagnostics)
    expect(records.map(record => !!record.formatting.defaulted)).toEqual([true, false])
    expect(diagnostics).toHaveLength(1)
  }
  expect(streams).toEqual(before)
})

it('charges filtered end flags and recovered paragraph allocations to their original budgets', () => {
  const streams = paragraphBoundaryStreams('nested-cell'), limits = resolveLimits({})
  const header = readWordHeader(streams.WordDocument!, limits)
  const storage = readTextStorage(streams.WordDocument!, streams['1Table']!, header, limits)
  const paragraphs = readParagraphRecords(streams.WordDocument!, streams['1Table']!, header, storage, limits).slice(0, 2)
  const bounded = { ...limits, maxPropertyOperations: 8 }
  expect(() => readTableRoles(paragraphs, storage, createPropertyReader(undefined, bounded), bounded, header.version))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  const missing = paragraphBoundaryStreams('missing')
  const missingHeader = readWordHeader(missing.WordDocument!, limits)
  const source = readTextStorage(missing.WordDocument!, missing['1Table']!, missingHeader, limits)
  const budget = { remaining: 1 }
  expect(() => readParagraphRecords(missing.WordDocument!, missing['1Table']!, missingHeader, source, limits, undefined, budget, []))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  expect(budget.remaining).toBe(0)
})

it('keeps an ending-piece override independent of a shared physical PAPX', () => {
  const direct = [...operation(0x2416, 1), ...operation(0x6649, 2, 0, 0, 0), ...operation(0x244b, 1)]
  const streams = withPiecePropertyGroup(withParagraphRecords(wordStreams([
    { units: [65, 13], unicode: false }, { units: [13, 13], unicode: false },
  ]), [{ cuts: [2048, 2051, 2052], records: [{ bytes: direct, odd: direct.length % 2 === 1 }, {}] }]), operation(0x244b, 1), 0)
  const limits = resolveLimits({}), header = readWordHeader(streams.WordDocument!, limits)
  const storage = readTextStorage(streams.WordDocument!, streams['1Table']!, header, limits)
  const records = readParagraphRecords(streams.WordDocument!, streams['1Table']!, header, storage, limits).slice(0, 2)
  expect(records[0]!.endsFormattingRecord).toBe(false)
  expect(readTableRoles(records, storage, createPropertyReader(undefined, limits), limits, header.version).map(role => role.role))
    .toEqual(['cell', 'cell'])
})

it('retains physical endpoint ownership when logical text pieces reverse source order', () => {
  const properties = [...operation(0x2416, 1), ...operation(0x6649, 2, 0, 0, 0), ...operation(0x244b, 1)]
  const streams = withParagraphRecords(wordStreams([
    { units: [65, 13], unicode: false }, { units: [13], unicode: false }, { units: [13], unicode: false },
  ], { reversePhysical: true }), [{ cuts: [2048, 2049, 2052], records: [{}, { bytes: properties }] }])
  const limits = resolveLimits({}), header = readWordHeader(streams.WordDocument!, limits)
  const storage = readTextStorage(streams.WordDocument!, streams['1Table']!, header, limits)
  const records = readParagraphRecords(streams.WordDocument!, streams['1Table']!, header, storage, limits).slice(0, 2)
  expect(records.map(record => record.endsFormattingRecord)).toEqual([true, false])
  expect(readTableRoles(records, storage, createPropertyReader(undefined, limits), limits, header.version).map(role => role.role))
    .toEqual(['cell', 'paragraph'])
})

import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { expect, it } from 'vitest'
import { fieldDocument } from '../../testing/fields/conversion'
import { operation as op } from '../../testing/formatting'
import { createDocxSourcePlan } from '../plan'

/** @param root - Complete typed XML. @param name - Word local name. @returns All matching elements in source order. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}
/** @param element - Typed XML element. @param name - Local attribute. @returns Exact stored scalar value. */
function attr(element: DocxXmlElementPlan, name: string) { return element.attributes.find(item => item.localName === name)?.value }
/** @param opcode - Complete property modifier. @param value - Unsigned source operand. @returns Independently encoded four-byte property. */
function dword(opcode: number, value: number): number[] { return op(opcode, value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24) }
/** @param text - Complete author storage. @param characters - Independent source operations. @param authors - Exact source author slots. @returns Actual native projection result. */
function convert(text: string, characters: NonNullable<NonNullable<Parameters<typeof fieldDocument>[1]>['characters']>, authors = ['Unknown', 'Alice', 'Bob']) {
  return createDocxSourcePlan(fieldDocument(text, { characters, revisionAuthors: authors }), { lossPolicy: 'best-effort' })
}

const insertedAt = (6 << 29 | 126 << 20 | 11 << 16 | 7 << 11 | 15 << 6 | 32) >>> 0
const deletedAt = (1 << 29 | 125 << 20 | 1 << 16 | 13 << 11 | 2 << 6 | 3) >>> 0

it('projects separate native insert/delete actors, floating dates, exact whitespace and paragraph marks', () => {
  const insertion = [...op(0x0801, 1), ...op(0x4804, 1, 0), ...dword(0x6805, insertedAt)]
  const deletion = [...op(0x0800, 1), ...op(0x4863, 2, 0), ...dword(0x6864, deletedAt)]
  const { plan, report } = convert('A add \tB\rC del \tD\rE\r', [
    { start: 1, end: 7, operations: insertion }, { start: 8, end: 9, operations: insertion },
    { start: 10, end: 16, operations: deletion }, { start: 17, end: 18, operations: deletion },
  ])
  const root = plan.parts[0]!.root!, inserted = nodes(root, 'ins'), deleted = nodes(root, 'del')
  expect(inserted).toHaveLength(2); expect(deleted).toHaveLength(2)
  expect(inserted.map(node => attr(node, 'author'))).toEqual(['Alice', 'Alice'])
  expect(deleted.map(node => attr(node, 'author'))).toEqual(['Bob', 'Bob'])
  expect(inserted.map(node => attr(node, 'date'))).toEqual(['2026-11-07T15:32:00', '2026-11-07T15:32:00'])
  expect(deleted.map(node => attr(node, 'date'))).toEqual(['2025-01-13T02:03:00', '2025-01-13T02:03:00'])
  expect(new Set([...inserted, ...deleted].map(node => attr(node, 'id'))).size).toBe(4)
  expect(nodes(root, 'delText').map(node => node.children)).toEqual([[' del ']])
  expect(nodes(root, 'delText').every(node => node.attributes.some(item => item.prefix === 'xml' && item.value === 'preserve'))).toBe(true)
  expect(nodes(root, 'pPr').flatMap(node => nodes(node, 'ins'))).toHaveLength(1)
  expect(nodes(root, 'pPr').flatMap(node => nodes(node, 'del'))).toHaveLength(1)
  expect(report.diagnostics.some(item => ['inserted-unprojected', 'deleted-unprojected', 'revision-content-unprojected'].includes(item.code))).toBe(false)
})

it.each(['', ' '])('retains an explicitly blank original author %j and an absent date without fabricating reviewer metadata', author => {
  const { plan } = convert('X\r', [{ start: 0, end: 1, operations: [...op(0x0801, 1), ...op(0x4804, 1, 0)] }], ['Unknown', author])
  const revision = nodes(plan.parts[0]!.root!, 'ins')[0]!
  expect(attr(revision, 'author')).toBe(author)
  expect(attr(revision, 'date')).toBeUndefined()
})

it('preserves unsigned save-session attributes independently of synthetic revision identity', () => {
  const { plan, report } = convert('X\r', [{ start: 0, end: 1, operations: [...op(0x0801, 1),
    ...dword(0x6816, 0xffffffff), ...dword(0x6817, 0), ...dword(0x6815, 0x80000000)] }])
  const root = plan.parts[0]!.root!, run = nodes(root, 'ins')[0]!.children[0] as DocxXmlElementPlan
  expect([attr(run, 'rsidR'), attr(run, 'rsidDel'), attr(run, 'rsidRPr')]).toEqual(['FFFFFFFF', '00000000', '80000000'])
  expect(attr(nodes(root, 'ins')[0]!, 'id')).toBe('0')
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'revision-save-session-host-limit', kind: 'host-limit' }))
})

it('honors an explicit false flag instead of fabricating an event from author/date operations', () => {
  const { plan, report } = convert('X\r', [{ start: 0, end: 1, operations: [...op(0x0801, 1), ...op(0x0801, 0),
    ...op(0x4804, 1, 0), ...dword(0x6805, insertedAt)] }])
  expect(nodes(plan.parts[0]!.root!, 'ins')).toEqual([])
  expect(nodes(plan.parts[0]!.root!, 't').map(node => node.children)).toEqual([['X']])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'inactive-revision-metadata-unprojected', kind: 'loss' }))
})

it.each([true, false])('reports inactive opposite-side metadata beside an active insertion=%s', insertion => {
  const { plan, report } = convert('X\r', [{ start: 0, end: 1, operations: [
    ...op(insertion ? 0x0801 : 0x0800, 1), ...op(insertion ? 0x4863 : 0x4804, 2, 0),
    ...dword(insertion ? 0x6864 : 0x6805, deletedAt),
  ] }])
  const root = plan.parts[0]!.root!
  expect(nodes(root, insertion ? 'ins' : 'del')).toHaveLength(1)
  expect(nodes(root, insertion ? 'del' : 'ins')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'inactive-revision-metadata-unprojected', kind: 'loss' }))
})

it('keeps dual states, resource controls and field-owned text under their existing owner with explicit losses', () => {
  const { plan, report } = convert('A\u0013PAGE\u00141\u0015Z\r', [
    { start: 0, end: 1, operations: [...op(0x0801, 1), ...op(0x0800, 1)] },
    { start: 1, end: 10, operations: op(0x0800, 1) },
  ])
  const root = plan.parts[0]!.root!
  expect(nodes(root, 'ins')).toEqual([]); expect(nodes(root, 'del')).toEqual([])
  expect(nodes(root, 'fldChar')).toHaveLength(3)
  expect(nodes(root, 'instrText').flatMap(node => node.children)).toEqual(['PAGE'])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'revision-content-unprojected', kind: 'loss' }))
})

it('does not turn a reviewed final paragraph mark into visible text or an editable ordinary boundary', () => {
  const { plan, report } = convert('X\r', [{ start: 1, end: 2, operations: op(0x0800, 1) }])
  expect(nodes(plan.parts[0]!.root!, 'del')).toEqual([])
  expect(nodes(plan.parts[0]!.root!, 't').flatMap(node => node.children)).toEqual(['X'])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'revision-paragraph-boundary-unprojected', kind: 'loss' }))
})

it.each([-1, 3])('recovers after an invalid author slot %i without inventing a reviewer', index => {
  const bytes = fieldDocument('X\r', { revisionAuthors: ['Unknown', 'Alice', 'Bob'],
    characters: [{ start: 0, end: 1, operations: [...op(0x0800, 1), ...op(0x4863, index & 255, index >> 8 & 255)] }] })
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' }))
    .toThrow(expect.objectContaining({ code: 'invalid-revision-data' }))
  const recovered = createDocxSourcePlan(bytes)
  expect(recovered.report.recovery?.cause).toBe('invalid-revision-data')
  expect(nodes(recovered.plan.parts[0]!.root!, 't')).toEqual([])
})

it('reports an invalid active calendar and keeps unknown timestamps absent', () => {
  const invalid = (126 << 20 | 2 << 16 | 30 << 11) >>> 0
  const { plan, report } = convert('XY\r', [
    { start: 0, end: 1, operations: [...op(0x0801, 1), ...dword(0x6805, invalid)] },
    { start: 1, end: 2, operations: [...op(0x0800, 1), ...dword(0x6864, 0)] },
  ])
  expect([...nodes(plan.parts[0]!.root!, 'ins'), ...nodes(plan.parts[0]!.root!, 'del')].every(node => attr(node, 'date') === undefined)).toBe(true)
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'revision-date-unprojected', kind: 'loss' }))
})

it.each([12, 14])('leaves reviewed structural break control %i with its existing owner and an explicit revision loss', code => {
  const { plan, report } = convert(`A${String.fromCharCode(code)}B\r`, [{ start: 0, end: 3, operations: op(0x0801, 1) }])
  const root = plan.parts[0]!.root!
  expect(nodes(root, 'ins')).toEqual([])
  expect(nodes(root, 'br').map(node => attr(node, 'type'))).toEqual([code === 12 ? 'page' : 'column'])
  expect(nodes(root, 't').flatMap(node => node.children)).toEqual(['A', 'B'])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'revision-content-unprojected', kind: 'loss' }))
})

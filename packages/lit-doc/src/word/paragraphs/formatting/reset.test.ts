import { expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { inspectDoc } from '../../../inspection'
import { operation as op } from '../../../testing/formatting'
import { styleResetDocument as document } from '../../../testing/style-reset'
import { tableDocument } from '../../../testing/tables/document'
import { createDocxSourcePlan } from '../../../conversion/plan'

/** @param owner - One exact typed XML owner. @param name - Direct child name. @returns Matching typed child. */
function child(owner: DocxXmlElementPlan, name: string): DocxXmlElementPlan {
  return owner.children.find((item): item is DocxXmlElementPlan => typeof item === 'object' && item.localName === name)!
}

it('replaces prior direct paragraph values, numbered style inheritance and tabs without mutating adjacent defaults', () => {
  const bytes = document([...op(0x2405, 0), ...op(0x840f, 0x90, 1), ...op(0xc60d, 5, 0, 1, 0xe0, 1, 0), ...op(0x4600, 15, 0)]), before = bytes.slice()
  const actual = inspectDoc(bytes, { includeCharacterFormatting: true, includeNumbering: true })
  expect(actual.paragraphs?.[0]?.baseFormat).toMatchObject({ styleIndex: 15, keepLines: true, keepNext: true,
    leftIndent: { twips: 0 }, tabs: { stops: [{ position: 720 }], changes: [] } })
  expect(actual.paragraphs?.[0]?.numbering).toMatchObject({ instanceIndex: 1 })
  expect(actual.paragraphs?.[1]?.baseFormat).toMatchObject({ styleIndex: 0, keepLines: false, keepNext: false, tabs: { stops: [] } })
  expect(actual.characterRuns?.[0]?.baseFormat).toMatchObject({ paragraphStyleIndex: 15, bold: false, fontSizeHalfPoints: 36 })
  expect(actual.characterRuns?.at(-1)?.baseFormat).toMatchObject({ paragraphStyleIndex: 0, bold: true, fontSizeHalfPoints: 20 })
  expect(bytes).toEqual(before)
})

it.each([0, 15])('resets direct values even when selecting the same style again, target=%i', target => {
  const actual = inspectDoc(document([...op(0x4600, target, 0), ...op(0x2405, 0), ...op(0x4600, target, 0), ...op(0x2406, 0)]), { includeParagraphFormatting: true })
  expect(actual.paragraphs?.[0]?.baseFormat).toMatchObject({ styleIndex: target, keepLines: target === 15, keepNext: false })
})

it.each([1, 9])('applies the source heading index %i outline rule without rewriting its definition', target => {
  const actual = inspectDoc(document(op(0x4600, target, 0)), { includeParagraphFormatting: true })
  expect(actual.paragraphs?.[0]?.baseFormat).toMatchObject({ styleIndex: target, outlineLevel: target - 1 })
})

it('lets the ending piece replace PAPX paragraph values and selects the same final character baseline', () => {
  const actual = inspectDoc(document([...op(0x2405, 0), ...op(0x840f, 0x90, 1)], op(0x4600, 15, 0), op(0x0835, 0x81)), { includeCharacterFormatting: true })
  expect(actual.paragraphs?.every(paragraph => paragraph.baseFormat?.styleIndex === 15 && paragraph.baseFormat.keepLines)).toBe(true)
  expect(actual.characterRuns?.[0]?.baseFormat).toMatchObject({ paragraphStyleIndex: 15, bold: true, fontSizeHalfPoints: 36 })
})

it.each([op(0x2a33, 0), op(0x4a30, 17, 0)].map(characters => ({ characters })))(
  'uses the replacement paragraph baseline through character reset %j', ({ characters }) => {
    const actual = inspectDoc(document(op(0x4600, 15, 0), undefined, characters), { includeCharacterFormatting: true })
    expect(actual.characterRuns?.[0]?.baseFormat).toMatchObject({ paragraphStyleIndex: 15, bold: false, fontSizeHalfPoints: 36 })
  })

it('clears superseded direct numbering before final validation and writes only the replacement style', () => {
  const bytes = document([...op(0x460b, 0xfe, 0x7f), ...op(0x260a, 8), ...op(0x4600, 0, 0)])
  expect(inspectDoc(bytes, { includeNumbering: true }).paragraphs?.[0]?.numbering).toMatchObject({ instanceIndex: null })
  const { plan } = createDocxSourcePlan(document([...op(0x2405, 0), ...op(0x4600, 15, 0)]), { lossPolicy: 'best-effort' })
  const main = plan.parts.find(part => part.root?.localName === 'document')!.root!, paragraph = child(child(main, 'body'), 'p')
  expect(child(child(paragraph, 'pPr'), 'pStyle').attributes).toContainEqual(expect.objectContaining({ localName: 'val', value: 'LegacyStyle15' }))
  expect(child(paragraph, 'pPr').children.some(item => typeof item === 'object' && ['keepLines', 'numPr', 'tabs'].includes(item.localName))).toBe(false)
})

it('preserves table membership, row definition and boundaries when resetting the row paragraph style', () => {
  const bytes = tableDocument([{ texts: ['A', 'B'], edges: [0, 1000, 2000], properties: op(0x4600, 0, 0) }])
  const actual = inspectDoc(bytes, { includeParagraphFormatting: true, includeTables: true })
  expect(actual.tables?.[0]?.rows[0]?.cells).toHaveLength(2)
  expect(actual.tables?.[0]?.rows[0]?.end).toBe(5)
})

it.each([14, 17, 0xfff])('keeps missing, wrong-kind and reserved style target %i refused', target => {
  expect(() => inspectDoc(document(op(0x4600, target & 255, target >>> 8)), { includeParagraphFormatting: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it('keeps unrelated compound operations refused and charges repeated style replacements', () => {
  expect(() => inspectDoc(document(op(0xc601, 0)), { includeParagraphFormatting: true })).toThrow()
  expect(() => inspectDoc(document(op(0x4600, 15, 0)), { includeCharacterFormatting: true, limits: { maxPropertyOperations: 2 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

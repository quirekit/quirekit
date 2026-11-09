import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { withCharacterRecords } from '../../testing/characters'
import { conversionRecords } from '../../testing/conversion'
import { operation as op, withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { numberingRecordsFixture, withNumberingRecords } from '../../testing/numbering'
import { wordStreams } from '../../testing/word'
import { createDocxSourcePlan } from '../plan'

/** @param reference - Child style's independently encoded list reference. @param active - Whether a paragraph inherits that child. @param descriptor - Whether the child stores an ANLD80 envelope. @param override - Explicit later modern paragraph override. @returns Minimal original DOC with one modern list and a separate style authority. */
function fixture(reference = 0x7ff, active = false, descriptor = true, override = false): Uint8Array {
  const properties = [...op(0x460b, reference & 255, reference >> 8), ...op(0x260a, 11),
    ...(descriptor ? op(0xc63e, 84, ...new Array<number>(84).fill(0)) : [])]
  const streams = withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 13, 66, 13], unicode: false }]), [{
    cuts: [2048, 2050, 2052], records: [{ style: active ? 15 : 0, odd: override,
      bytes: override ? [...op(0x460b, 1, 0), ...op(0x260a, 0)] : [] }, { style: 0, bytes: [] }],
  }]), [{ index: 0, properties: [...op(0x460b, 1, 0), ...op(0x260a, 0)] },
    { index: 15, parent: 0, properties }, { index: 16, parent: 15, properties: [] }])
  return compoundFixture(withNumberingRecords(conversionRecords(withCharacterRecords(streams,
    [{ cuts: [2048, 2052] }]), 4), numberingRecordsFixture()))
}

/** @param root - Actual typed output tree. @param name - Local XML name. @returns Matching descendants in source order. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}

/** @param node - Actual output node. @param name - Local attribute. @returns Exact generated value. */
function value(node: DocxXmlElementPlan, name: string): unknown { return node.attributes.find(attribute => attribute.localName === name)?.value }

it.each([false, true])('keeps the complete modern graph with an unused legacy style, descriptor=%s', descriptor => {
  const bytes = fixture(0x7ff, false, descriptor), before = bytes.slice(), { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  const numbering = plan.parts.find(part => part.name === '/word/numbering.xml')!.root!
  expect(nodes(numbering, 'num').map(node => value(node, 'numId'))).toEqual(['1'])
  expect(nodes(numbering, 'lvlText').map(node => value(node, 'val'))).toEqual(['%1.'])
  const styles = plan.parts.find(part => part.name === '/word/styles.xml')!.root!
  for (const index of [15, 16]) {
    const style = nodes(styles, 'style').find(node => value(node, 'styleId') === `LegacyStyle${index}`)!
    expect(nodes(style, 'numId').map(node => value(node, 'val'))).toEqual(['0'])
    expect(nodes(style, 'ilvl')).toEqual([])
    expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'legacy-style-numbering-unprojected', kind: 'loss', source: `style:${index}` }))
  }
  const body = plan.parts.find(part => part.name === '/word/document.xml')!.root!
  expect(nodes(body, 't').map(node => node.children.join(''))).toEqual(['A', 'B'])
  expect(report.diagnostics.some(item => item.code === 'numbering-graph-unprojected')).toBe(false)
  expect(bytes).toEqual(before)
})

it('respects a direct modern override of the inherited old reference and old level', () => {
  const { plan, report } = createDocxSourcePlan(fixture(0x7ff, true, true, true), { lossPolicy: 'best-effort' })
  expect(plan.parts.some(part => part.name === '/word/numbering.xml')).toBe(true)
  const body = plan.parts.find(part => part.name === '/word/document.xml')!.root!
  expect(nodes(body, 'numId').map(node => value(node, 'val'))).toEqual(['1'])
  expect(report.diagnostics.some(item => item.code === 'numbering-graph-unprojected')).toBe(false)
})

it('keeps actual old paragraph numbering outside the admitted modern graph', () => {
  const { plan, report } = createDocxSourcePlan(fixture(0x7ff, true), { lossPolicy: 'best-effort' })
  expect(plan.parts.some(part => part.name === '/word/numbering.xml')).toBe(false)
  expect(report.diagnostics.some(item => item.code === 'numbering-graph-unprojected')).toBe(true)
})

it.each([2, 0x7fe, 0x800, 0xffff])('retains whole-graph refusal for the unrelated style reference %i', reference => {
  const { plan, report } = createDocxSourcePlan(fixture(reference), { lossPolicy: 'best-effort' })
  expect(plan.parts.some(part => part.name === '/word/numbering.xml')).toBe(false)
  expect(report.diagnostics.some(item => item.code === 'numbering-graph-unprojected')).toBe(true)
})

it('retains strict loss admission and public strict source validation', () => {
  expect(() => createDocxSourcePlan(fixture(), { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ report: expect.objectContaining({ lossy: true }) }))
  expect(() => inspectDoc(fixture(0x7ff, true), { includeNumbering: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-numbering-data' }))
})

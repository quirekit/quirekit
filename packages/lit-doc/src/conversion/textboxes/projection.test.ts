import { expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { textboxDocument } from '../../testing/textboxes/conversion'
import { createDocxSourcePlan } from '../plan'
import { operation } from '../../testing/formatting'
import { bitmapRecord, inlinePicture } from '../../testing/pictures/records'

/** @param root - Actual typed package element. @param name - Local XML name. @returns Matching elements in source order. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}
/** @param element - Actual output element. @param name - Local attribute. @returns Actual normalized scalar. */
function attr(element: DocxXmlElementPlan, name: string) { return element.attributes.find(item => item.localName === name)?.value }

it('projects one exact source textbox into a separate formatted story, retaining author blank paragraphs', () => {
  const { plan, report } = createDocxSourcePlan(textboxDocument([[129, 0], [135, 1]]), { lossPolicy: 'best-effort' })
  const root = plan.parts[0]!.root!, boxes = nodes(root, 'txbxContent')
  expect(boxes).toHaveLength(1); expect(nodes(boxes[0]!, 'p')).toHaveLength(2)
  expect(nodes(boxes[0]!, 't').flatMap(value => value.children)).toEqual(['Bold'])
  expect(nodes(boxes[0]!, 'b').map(value => attr(value, 'val'))).toEqual(['1'])
  expect(nodes(root, 'positionH').map(value => attr(value, 'relativeFrom'))).toEqual(['column'])
  expect(nodes(root, 'posOffset').flatMap(value => value.children)).toEqual(['-19050', '25400'])
  expect(nodes(root, 'bodyPr').map(value => [attr(value, 'lIns'), attr(value, 'tIns'), attr(value, 'anchor')])).toEqual([['0', '45720', 'ctr']])
  expect(report.diagnostics.some(value => value.code === 'floating-textbox-unprojected')).toBe(false)
  expect(plan.resources).toEqual([])
})

it.each([{ chain: 2, txid: 65536 }, { chain: 1, txid: 131072 }, { chain: 1, txid: 65537 }])('refuses incomplete or mismatched original text ownership %j', ({ chain, txid }) => {
  const { plan, report } = createDocxSourcePlan(textboxDocument([], chain, txid), { lossPolicy: 'best-effort' })
  expect(nodes(plan.parts[0]!.root!, 'txbxContent')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'floating-textbox-unprojected', kind: 'loss', start: 1, end: 2 }))
})

it.each([[136, 2], [138, 1027], [129, -1], [135, 7]])('explicitly refuses unsupported source text-body property %i=%i', (id, value) => {
  const { plan, report } = createDocxSourcePlan(textboxDocument([[id, value]]), { lossPolicy: 'best-effort' })
  expect(nodes(plan.parts[0]!.root!, 'txbxContent')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'floating-textbox-unprojected' }))
})

it('normalizes a legacy SHAPE wrapper while retaining its independently editable drawing and rich content', () => {
  const { plan, report } = createDocxSourcePlan(textboxDocument([], 1, 65536, true), { lossPolicy: 'best-effort' })
  expect(nodes(plan.parts[0]!.root!, 'txbxContent')).toHaveLength(1)
  expect(nodes(plan.parts[0]!.root!, 'fldChar')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'legacy-shape-field-normalized', kind: 'loss' }))
})

it('uses the exact single-frame text owner to admit a self next-shape operand without creating a linked story', () => {
  const { plan, report } = createDocxSourcePlan(textboxDocument([[138, 1026]]), { lossPolicy: 'best-effort' })
  const root = plan.parts[0]!.root!, boxes = nodes(root, 'txbxContent')
  expect(boxes).toHaveLength(1)
  expect(nodes(boxes[0]!, 't').flatMap(value => value.children)).toEqual(['Bold'])
  expect(nodes(root, 'linkedTxbx')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'textbox-self-link-variant', kind: 'compatibility', start: 1, end: 2 }))
  const refused = createDocxSourcePlan(textboxDocument([[138, 1026]], 2), { lossPolicy: 'best-effort' })
  expect(nodes(refused.plan.parts[0]!.root!, 'txbxContent')).toEqual([])
  expect(refused.report.diagnostics.some(value => value.code === 'textbox-self-link-variant')).toBe(false)
})

it('refuses a self link when a second active descriptor claims the same source shape and keeps allocation limits fatal', () => {
  const bytes = textboxDocument([[138, 1026]], 1, 65536, false, { text: 'Owner\r', duplicateOwner: true })
  const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(nodes(plan.parts[0]!.root!, 'txbxContent')).toEqual([])
  expect(report.diagnostics.some(value => value.code === 'textbox-self-link-variant')).toBe(false)
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'floating-textbox-unprojected', start: 1, end: 2 }))
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxTextboxEntries: 2 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it('installs textbox image relationships only after its complete author story succeeds', () => {
  const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0), data = inlinePicture([bitmapRecord(png)])
  const characters = [{ start: 1, end: 2, operations: [...operation(0x0855, 1), ...operation(0x6a03, 0, 0, 0, 0)] }]
  const bytes = textboxDocument([], 1, 65536, false, { text: 'A\u0001B\r', data, characters })
  const { plan } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(plan.resources).toHaveLength(1); expect(plan.resources[0]!.data).toEqual(png)
  expect(plan.relationships.filter(value => value.relationshipType.endsWith('/image')).map(value => value.sourcePart)).toEqual(['/word/document.xml'])
  expect(nodes(nodes(plan.parts[0]!.root!, 'txbxContent')[0]!, 'blip')).toHaveLength(1)
  const broken = textboxDocument([], 1, 65536, false, { text: 'A\u0001\u0013BROKEN\r', data, characters })
  const refused = createDocxSourcePlan(broken, { lossPolicy: 'best-effort' })
  expect(refused.plan.resources).toEqual([])
  expect(refused.plan.relationships.filter(value => value.relationshipType.endsWith('/image'))).toEqual([])
  expect(nodes(refused.plan.parts[0]!.root!, 'txbxContent')).toEqual([])
  expect(refused.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'floating-textbox-unprojected' }))
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxTotalPictureBytes: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

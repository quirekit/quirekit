import { expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { linkedTextboxDocument } from '../../testing/textboxes/links'
import { createDocxSourcePlan } from '../plan'
import { operation } from '../../testing/formatting'
import { bitmapRecord, inlinePicture } from '../../testing/pictures/records'

/** @param root - Typed output. @param name - Local XML name. @returns Matching elements in actual output order. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}
/** @param element - Output element. @param name - Local attribute. @returns Actual serialized scalar. */
function attr(element: DocxXmlElementPlan, name: string) { return element.attributes.find(item => item.localName === name)?.value }

it.each([2, 3])('projects %i independently anchored frames with exactly one complete author story', count => {
  const frames = Array.from({ length: count }, (_, index) => ({ shapeId: 1026 + index, textId: 65536 + index,
    nextShapeId: index + 1 === count ? 0 : 1027 + index, properties: [[129, index * 1000], [135, index % 3]] as const }))
  const { plan, report } = createDocxSourcePlan(linkedTextboxDocument({ frames }), { lossPolicy: 'best-effort' })
  const root = plan.parts[0]!.root!, boxes = nodes(root, 'txbxContent'), links = nodes(root, 'linkedTxbx')
  expect(nodes(root, 'anchor')).toHaveLength(count); expect(boxes).toHaveLength(1)
  expect(nodes(boxes[0]!, 't').flatMap(value => value.children)).toEqual(['One author story.', 'Second paragraph.'])
  expect(nodes(root, 'txbx').map(value => attr(value, 'id'))).toEqual(['1'])
  expect(links.map(value => [attr(value, 'id'), attr(value, 'seq')])).toEqual(Array.from({ length: count - 1 }, (_, i) => ['1', String(i + 1)]))
  expect(nodes(root, 'bodyPr').map(value => [attr(value, 'lIns'), attr(value, 'anchor')])).toEqual(frames.map((_, i) => [String(i * 1000), ['t', 'ctr', 'b'][i]]))
  expect(report.diagnostics.filter(value => ['floating-textbox-unprojected', 'textbox-content-unreferenced'].includes(value.code))).toEqual([])
})

it('preserves original CP order even when the chain continuation is encountered before its author frame', () => {
  const { plan } = createDocxSourcePlan(linkedTextboxDocument({ order: [1, 0] }), { lossPolicy: 'best-effort' })
  const root = plan.parts[0]!.root!
  expect(nodes(root, 'docPr').map(value => attr(value, 'name'))).toEqual(['doc-textbox-1027', 'doc-textbox-1026'])
  expect(nodes(root, 'txbxContent')).toHaveLength(1)
  expect(nodes(root, 'anchor').map(value => nodes(value, 'posOffset')[0]!.children)).toEqual([['1524000'], ['0']])
})

it('admits a native producer count-one variant only with a complete independent multi-frame graph', () => {
  const { plan, report } = createDocxSourcePlan(linkedTextboxDocument({ count: 1 }), { lossPolicy: 'best-effort' })
  expect(nodes(plan.parts[0]!.root!, 'linkedTxbx')).toHaveLength(1)
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'textbox-chain-count-variant', kind: 'compatibility' }))
})

it('retains the existing occurrence-id reservation when a refused source frame precedes a native single-frame owner', () => {
  const bytes = linkedTextboxDocument({ frames: [{ shapeId: 1026, textId: 0, nextShapeId: 0 }, { shapeId: 1027, textId: 65536, nextShapeId: 0 }],
    owner: 1027, count: 1 })
  const { plan } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxPictures: 10 } })
  expect(nodes(plan.parts[0]!.root!, 'docPr').map(node => [attr(node, 'name'), attr(node, 'id')])).toEqual([['doc-textbox-1027', '12']])
})

it.each([
  { frames: [{ shapeId: 1026, textId: 65536, nextShapeId: 1027 }, { shapeId: 1027, textId: 65538, nextShapeId: 0 }] },
  { frames: [{ shapeId: 1026, textId: 65536, nextShapeId: 1027 }, { shapeId: 1027, textId: 131073, nextShapeId: 0 }] },
  { frames: [{ shapeId: 1026, textId: 65536, nextShapeId: 1027 }, { shapeId: 1027, textId: 65537, nextShapeId: 1026 }] },
  { frames: [{ shapeId: 1026, textId: 65536, nextShapeId: 1027 }, { shapeId: 1027, textId: 65537, nextShapeId: 1027 }] },
  { frames: [{ shapeId: 1026, textId: 65536, nextShapeId: 1027 }, { shapeId: 1027, textId: 65537, nextShapeId: 0, properties: [[135, 7]] }] },
  { order: [0, 1, 1] }, { count: 3 }, { owner: 1027 }, { separator: '\r' }, { separator: '\u0013 SHAPE \u0014\u0015' },
  { author: { text: 'Duplicated owner\r', duplicateOwner: true } },
  { frames: [{ shapeId: 1026, textId: 65536, nextShapeId: 0 }, { shapeId: 1027, textId: 65537, nextShapeId: 0 }], count: 1 },
  { frames: [{ shapeId: 1026, textId: 65536, nextShapeId: 1027 }, { shapeId: 1027, textId: 65537, nextShapeId: 0 },
    { shapeId: 1028, textId: 131072, nextShapeId: 1027 }] },
] as const)('refuses the whole chain before any author or frame is reachable: %j', options => {
  const { plan, report } = createDocxSourcePlan(linkedTextboxDocument(options), { lossPolicy: 'best-effort' })
  expect(nodes(plan.parts[0]!.root!, 'anchor')).toEqual([])
  expect(nodes(plan.parts[0]!.root!, 'txbxContent')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'floating-textbox-unprojected', kind: 'loss' }))
})

it('keeps author media private until every continuation has passed and keeps spent work bounded', () => {
  const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0), data = inlinePicture([bitmapRecord(png)])
  const author = { text: 'A\u0001B\r', data, characters: [{ start: 1, end: 2, operations: [...operation(0x0855, 1), ...operation(0x6a03, 0, 0, 0, 0)] }] }
  const valid = createDocxSourcePlan(linkedTextboxDocument({ author }), { lossPolicy: 'best-effort' })
  expect(valid.plan.resources).toHaveLength(1)
  expect(valid.plan.relationships.filter(value => value.relationshipType.endsWith('/image'))).toHaveLength(1)
  const frames = [{ shapeId: 1026, textId: 65536, nextShapeId: 1027 }, { shapeId: 1027, textId: 65537, nextShapeId: 0, properties: [[135, 7]] as const }]
  const failed = createDocxSourcePlan(linkedTextboxDocument({ author, frames }), { lossPolicy: 'best-effort' })
  expect(failed.plan.resources).toEqual([])
  expect(failed.plan.relationships.filter(value => value.relationshipType.endsWith('/image'))).toEqual([])
  expect(() => createDocxSourcePlan(linkedTextboxDocument({ author }), { lossPolicy: 'best-effort', limits: { maxDrawings: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

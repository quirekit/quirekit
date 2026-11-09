import { expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { fieldDocument } from '../../testing/fields/conversion'
import { floatingPictureFixture } from '../../testing/drawings/pictures'
import { pictureProperties } from '../../testing/pictures/records'
import { operation as op } from '../../testing/formatting'
import { createDocxSourcePlan } from '../plan'

/** @param root - Complete actual typed element. @param name - Local element name. @returns Every matching element in physical order. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}
/** @param element - Actual typed element. @param name - Local attribute. @returns Original projected scalar. */
function attr(element: DocxXmlElementPlan, name: string) { return element.attributes.find(item => item.localName === name)?.value }
/** @param properties - Independent local source properties. @param flags - Raw source FSPA flags. @param shapeFlags - Original FSP role. @param special - Final source character special flag. @returns Actual public conversion result. */
function convert(properties: readonly Uint8Array[] = [], flags = 0x54, shapeFlags = 0xa00, special = true) {
  return createDocxSourcePlan(fieldDocument('A\u0008B\r', { drawings: floatingPictureFixture(properties, flags, shapeFlags),
    characters: [{ start: 1, end: 2, operations: op(0x0855, special ? 1 : 0) }] }), { lossPolicy: 'best-effort' })
}

it('projects the original media, FSPA creation rectangle and independent ordinary floating references', () => {
  const { plan, report } = convert(), root = plan.parts[0]!.root!
  const anchor = nodes(root, 'anchor')[0]!
  expect(anchor).toBeDefined(); expect(nodes(root, 'inline')).toEqual([])
  expect(nodes(root, 't').flatMap(node => node.children)).toEqual(['A', 'B'])
  expect(nodes(anchor, 'extent').map(node => [attr(node, 'cx'), attr(node, 'cy')])).toEqual([['952500', '714375']])
  expect(nodes(anchor, 'positionH').map(node => attr(node, 'relativeFrom'))).toEqual(['column'])
  expect(nodes(anchor, 'positionV').map(node => attr(node, 'relativeFrom'))).toEqual(['paragraph'])
  expect(nodes(anchor, 'posOffset').flatMap(node => node.children)).toEqual(['-19050', '25400'])
  expect(nodes(anchor, 'wrapSquare').map(node => attr(node, 'wrapText'))).toEqual(['bothSides'])
  expect([attr(anchor, 'distL'), attr(anchor, 'distT'), attr(anchor, 'distR'), attr(anchor, 'distB')]).toEqual(['114300', '0', '114300', '0'])
  expect(plan.resources).toHaveLength(1)
  expect(plan.resources[0]!.data).toEqual(Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0))
  expect(report.diagnostics.some(item => item.code === 'object-anchor-unprojected')).toBe(false)
})

it('keeps page alignment, explicit zero distance and per-bit layout/overlap flags independent', () => {
  const { plan } = convert([pictureProperties([[911, 2], [912, 2], [913, 0], [914, 2], [900, 0],
    [959, 0x82000000]], 0xf122)])
  const anchor = nodes(plan.parts[0]!.root!, 'anchor')[0]!
  expect(nodes(anchor, 'positionH').map(node => [attr(node, 'relativeFrom'), node.children])).toMatchObject([['page', [expect.objectContaining({ localName: 'align', children: ['center'] })]]])
  expect(nodes(anchor, 'positionV').map(node => attr(node, 'relativeFrom'))).toEqual(['page'])
  expect([attr(anchor, 'distL'), attr(anchor, 'layoutInCell'), attr(anchor, 'allowOverlap')]).toEqual(['0', '0', '0'])
})

it.each([4, 5])('reports a source contour mode %i approximation before using the admitted square owner', wrap => {
  const { plan, report } = convert([], (0x54 & ~0x1e0) | wrap << 5)
  expect(nodes(plan.parts[0]!.root!, 'wrapSquare')).toHaveLength(1)
  expect(nodes(plan.parts[0]!.root!, wrap === 4 ? 'wrapTight' : 'wrapThrough')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'floating-picture-wrap-approximated', kind: 'approximation' }))
})

it('does not turn an ignored FSPA below-text bit into a conflicting foreground authority', () => {
  const { plan, report } = convert([pictureProperties([[959, 0x00200020]])], 0x4094)
  const anchor = nodes(plan.parts[0]!.root!, 'anchor')[0]!
  expect(anchor).toBeDefined(); expect(attr(anchor, 'behindDoc')).toBe('1')
  expect(report.diagnostics.some(item => item.code === 'floating-picture-unprojected')).toBe(false)
})

it.each([{ shapeFlags: 0xa10, special: true }, { shapeFlags: 0xa00, special: false }])('refuses invalid ordinary picture ownership %j without orphan resources', ({ shapeFlags, special }) => {
  const { plan, report } = convert([], 0x54, shapeFlags, special)
  expect(nodes(plan.parts[0]!.root!, 'drawing')).toEqual([]); expect(plan.resources).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'floating-picture-unprojected', kind: 'loss' }))
})

it.each([[912, 0], [914, 0], [900, -1], [903, -635]])('refuses source property %i=%i instead of replacing it with a default', (id, value) => {
  const { plan, report } = convert([pictureProperties([[id, value]])])
  expect(nodes(plan.parts[0]!.root!, 'anchor')).toEqual([])
  expect(plan.resources).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'floating-picture-unprojected', kind: 'loss', start: 1, end: 2 }))
})

it('propagates drawing and decoded-byte budget failures instead of reporting a successful image omission', () => {
  const bytes = fieldDocument('A\u0008B\r', { drawings: floatingPictureFixture(),
    characters: [{ start: 1, end: 2, operations: op(0x0855, 1) }] })
  for (const limits of [{ maxDrawings: 1 }, { maxPictureBytes: 1 }, { maxTotalPictureBytes: 1 }])
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it('checks exact ClientAnchor association before creating a reachable media relationship', () => {
  const bytes = fieldDocument('A\u0008B\r', { drawings: floatingPictureFixture([], 0x54, 0xa00, { clientIndexOffset: 1 }),
    characters: [{ start: 1, end: 2, operations: op(0x0855, 1) }] })
  const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(plan.resources).toEqual([])
  expect(nodes(plan.parts[0]!.root!, 'drawing')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'floating-picture-unprojected', message: expect.stringContaining('ClientAnchor') }))
})

it('shares decoded media while keeping occurrence identities and cumulative occurrence byte limits distinct', () => {
  const bytes = fieldDocument('A\u0008B\u0008C\r', { drawings: floatingPictureFixture([], 0x54, 0xa00, { positions: [1, 3] }),
    characters: [{ start: 1, end: 4, operations: op(0x0855, 1) }] })
  const { plan } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  const anchors = nodes(plan.parts[0]!.root!, 'anchor')
  expect(anchors).toHaveLength(2); expect(plan.resources).toHaveLength(1)
  expect(anchors.map(anchor => attr(nodes(anchor, 'docPr')[0]!, 'id'))).toEqual(['1', '2'])
  for (const limits of [{ maxPictures: 1 }, { maxTotalPictureBytes: 9 }])
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it('recovers a stale zero ClientAnchor only through a unique original same-part FSPA association', () => {
  const bytes = fieldDocument('A\u0008B\u0008C\r', { drawings: floatingPictureFixture([], 0x54, 0xa00, { positions: [1, 3], clientIndices: [0, 0] }),
    characters: [{ start: 1, end: 4, operations: op(0x0855, 1) }] })
  const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(nodes(plan.parts[0]!.root!, 'anchor')).toHaveLength(2)
  expect(plan.resources).toHaveLength(1)
  expect(report.diagnostics.filter(item => item.code === 'floating-picture-unprojected')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'drawing-client-anchor-variant', kind: 'compatibility', start: 3, end: 4 }))
})

it('keeps a stale zero with multiple FSPA aliases outside the ordinary recovery path', () => {
  const bytes = fieldDocument('A\u0008B\u0008C\r', { drawings: floatingPictureFixture([], 0x54, 0xa00,
    { positions: [1, 3], clientIndices: [0, 0], anchorShapeIds: [1025, 1025] }),
  characters: [{ start: 1, end: 4, operations: op(0x0855, 1) }] })
  const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(nodes(plan.parts[0]!.root!, 'anchor')).toHaveLength(1)
  expect(plan.resources).toHaveLength(1)
  expect(report.diagnostics.filter(item => item.code === 'drawing-client-anchor-variant')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'floating-picture-unprojected', kind: 'loss', start: 3, end: 4 }))
})

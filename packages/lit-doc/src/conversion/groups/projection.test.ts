import { expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { createDocxSourcePlan } from '../plan'
import { groupedDrawingDocument } from '../../testing/drawings/groups'

/** @param node - XML plan subtree. @param name - Local element name. @returns Matching complete namespace-aware elements. */
function nodes(node: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(node.localName === name ? [node] : []), ...node.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}

/** @param node - Typed XML element. @returns Ordinary scalar attributes by local name. */
function attributes(node: DocxXmlElementPlan): Record<string, unknown> { return Object.fromEntries(node.attributes.map(value => [value.localName, value.value])) }

it.each([false, true])('keeps every picture/text owner and original group, nested=%s', nested => {
  const bytes = groupedDrawingDocument({ nested }), before = bytes.slice(), result = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  const root = result.plan.parts.find(part => part.name === '/word/document.xml')!.root!
  expect(nodes(root, 'wgp')).toHaveLength(1); expect(nodes(root, 'grpSp')).toHaveLength(nested ? 1 : 0)
  expect(nodes(root, 'wsp')).toHaveLength(2); expect(nodes(root, 'pic')).toHaveLength(1)
  expect(nodes(root, 't').flatMap(value => value.children).join('')).toBe('AOneTwoB')
  const box = nodes(root, 'wsp').find(node => nodes(node, 't').some(value => value.children.includes('One')))!
  expect(attributes(nodes(box, 'off')[0]!)).toEqual({ x: '95250', y: '47625' })
  expect(attributes(nodes(box, 'ext')[0]!)).toEqual({ cx: '381000', cy: '142875' })
  expect(result.plan.resources).toHaveLength(1); expect(result.plan.relationships.filter(value => value.relationshipType.endsWith('/image'))).toHaveLength(1)
  expect(result.report.diagnostics.some(value => value.code === 'textbox-content-unreferenced')).toBe(false)
  expect(bytes).toEqual(before)
})

it('does not claim earlier text or install picture resources when the last text owner fails', () => {
  const result = createDocxSourcePlan(groupedDrawingDocument({ invalidLast: true }), { lossPolicy: 'best-effort' })
  const root = result.plan.parts.find(part => part.name === '/word/document.xml')!.root!
  expect(nodes(root, 'wgp')).toEqual([]); expect(result.plan.resources).toEqual([])
  expect(result.plan.relationships.some(value => value.relationshipType.endsWith('/image'))).toBe(false)
  expect(result.report.diagnostics.find(value => value.code === 'textbox-content-unreferenced')?.occurrences).toBe(2)
})

it('keeps a rotated parent outside the existing simple-group host contract', () => {
  const result = createDocxSourcePlan(groupedDrawingDocument({ rotation: 65536 }), { lossPolicy: 'best-effort' })
  const root = result.plan.parts.find(part => part.name === '/word/document.xml')!.root!
  expect(nodes(root, 'wgp')).toEqual([]); expect(result.plan.resources).toEqual([])
  expect(result.report.diagnostics.some(value => value.code === 'floating-group-unprojected')).toBe(true)
})

it('charges one image, without charging the compound root as a second picture', () => {
  const result = createDocxSourcePlan(groupedDrawingDocument(), { lossPolicy: 'best-effort', limits: { maxPictures: 1 } })
  expect(result.plan.resources).toHaveLength(1)
  const root = result.plan.parts.find(part => part.name === '/word/document.xml')!.root!
  const ids = nodes(root, 'cNvPr').map(node => attributes(node).id)
  expect(new Set(ids).size).toBe(ids.length)
})

it.each([{ duplicateId: true }, { childRotation: 65536, anisotropic: true }])('refuses a complete invalid group without claiming content: %j', options => {
  const result = createDocxSourcePlan(groupedDrawingDocument(options), { lossPolicy: 'best-effort' })
  const root = result.plan.parts.find(part => part.name === '/word/document.xml')!.root!
  expect(nodes(root, 'wgp')).toHaveLength(0); expect(result.plan.resources).toHaveLength(0)
  expect(result.report.diagnostics.find(value => value.code === 'textbox-content-unreferenced')?.occurrences).toBe(2)
})

it('retains a rotated leaf under equal parent scales', () => {
  const result = createDocxSourcePlan(groupedDrawingDocument({ childRotation: 65536 }), { lossPolicy: 'best-effort' })
  const root = result.plan.parts.find(part => part.name === '/word/document.xml')!.root!
  expect(nodes(root, 'wgp')).toHaveLength(1)
  expect(nodes(root, 'xfrm').some(node => attributes(node).rot === '60000')).toBe(true)
})

it('keeps failed group work subject to document output and media budgets', () => {
  expect(() => createDocxSourcePlan(groupedDrawingDocument(), { lossPolicy: 'best-effort', limits: { maxDrawings: 2 } }))
    .toThrow(/(drawing|shape).*limit/iu)
  expect(() => createDocxSourcePlan(groupedDrawingDocument(), { lossPolicy: 'best-effort', limits: { maxTotalPictureBytes: 8 } }))
    .toThrow(/byte limit exceeded/u)
})

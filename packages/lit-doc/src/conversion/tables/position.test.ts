import { expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { tableDocument } from '../../testing/tables/document'
import { operation } from '../../testing/formatting'
import { createDocxSourcePlan } from '../plan'

/** @param root - Typed XML. @param name - Element local name. @returns All matching descendants. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}

/** @param element - Complete typed Word element. @returns Plain attribute values. */
function attributes(element: DocxXmlElementPlan) { return Object.fromEntries(element.attributes.map(attribute => [attribute.localName, attribute.value])) }

it('projects complete physical positioning and retains it when optional geometry is refused', () => {
  for (const edges of [[0, 1440], [0, 0]]) {
    const bytes = tableDocument([{ texts: ['A'], edges, properties: [
      ...operation(0x360d, 0x90), ...operation(0x940e, 0xa1, 5), ...operation(0x940f, 0xd1, 2),
      ...operation(0x9410, 180, 0), ...operation(0x941e, 187, 0), ...operation(0x3465, 1),
    ] }])
    const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
    expect(attributes(nodes(plan.parts[0]!.root!, 'tblpPr')[0]!)).toEqual({
      horzAnchor: 'page', vertAnchor: 'page', tblpX: '1441', tblpY: '721',
      leftFromText: '180', rightFromText: '187', topFromText: '0', bottomFromText: '0',
    })
    expect(attributes(nodes(plan.parts[0]!.root!, 'tblOverlap')[0]!)).toEqual({ val: 'never' })
    expect(nodes(plan.parts[0]!.root!, 't').flatMap(node => node.children)).toEqual(['A'])
    expect(report.diagnostics.some(item => item.code === 'table-geometry-unprojected')).toBe(edges[1] === 0)
    expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'table-position-offset-compatibility', kind: 'compatibility' }))
  }
})

it('keeps source special values as exact OOXML alignments and diagnoses the inline vertical host gap', () => {
  const { plan, report } = createDocxSourcePlan(tableDocument([{ texts: ['A'], edges: [0, 1440],
    properties: [...operation(0x360d, 0x20), ...operation(0x940e, 0xf4, 0xff)] }]), { lossPolicy: 'best-effort' })
  expect(attributes(nodes(plan.parts[0]!.root!, 'tblpPr')[0]!)).toMatchObject({ horzAnchor: 'text', vertAnchor: 'text', tblpXSpec: 'inside', tblpYSpec: 'inline' })
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'table-floating-position-host-limit', kind: 'host-limit' }))
})

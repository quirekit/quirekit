import { describe, expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { createProjectionContext } from '../xml/context'
import { sectionProperties } from './properties'

/** @param opcode - Independent source modifier. @param bytes - Complete operand. @returns Source operation. */
function operation(opcode: number, ...bytes: number[]) { return { opcode, operand: Uint8Array.from(bytes) } }
const margins = [0xb021, 0xb022, 0x9023, 0x9024, 0xb017, 0xb018, 0x900c].map(code => operation(code, 0xd0, 2))
/** @param extra - Source operations after page margins. @param limits - Optional XML work ceiling. @returns Page borders and located report. */
function project(extra: ReturnType<typeof operation>[], limits = {}) {
  const context = createProjectionContext({ outputLimits: limits }, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 1 })
  const section = sectionProperties([...margins, ...extra], context, 'section:0')
  return { section, borders: section.children.find(child => typeof child !== 'string' && child.localName === 'pgBorders') as DocxXmlElementPlan | undefined, report: context.report }
}
/** @param node - Actual typed element. @returns Exact attributes. */
function attrs(node: DocxXmlElementPlan) { return Object.fromEntries(node.attributes.map(value => [value.localName, value.value])) }

describe('ordinary section page borders', () => {
  it('uses newer RGB records over older palette records in either opcode order, without rewriting margins', () => {
    const old = operation(0x702b, 12, 6, 6, 24), modern = operation(0xd234, 8, 250, 103, 12, 0, 12, 6, 24, 0)
    for (const operations of [[old, modern], [modern, old]]) {
      const result = project([...operations, operation(0x522f, 0x29, 0)])
      expect(attrs(result.borders!)).toEqual({ display: 'firstPage', zOrder: 'back', offsetFrom: 'page' })
      expect(attrs(result.borders!.children[0] as DocxXmlElementPlan)).toEqual({ val: 'dotted', sz: '12', space: '24', color: 'FA670C', shadow: '0', frame: '0' })
      expect(result.report.diagnostics).toEqual([expect.objectContaining({ code: 'page-borders-host-limit', kind: 'host-limit', source: 'section:0' })])
      expect(result.report.lossy).toBe(false)
      const names = result.section.children.map(child => typeof child === 'string' ? child : child.localName)
      expect(names.indexOf('pgBorders')).toBe(names.indexOf('pgMar') + 1)
      expect(attrs(result.section.children.find(child => typeof child !== 'string' && child.localName === 'pgMar') as DocxXmlElementPlan).top).toBe('720')
    }
  })
  it('keeps automatic color, explicit effects, side order, defaults and the old minimum-width rule', () => {
    const result = project([operation(0x702e, 1, 1, 11, 0x61), operation(0xd234, 8, 0, 0, 0, 255, 36, 1, 28, 0)])
    expect(attrs(result.borders!)).toEqual({ display: 'allPages', zOrder: 'front', offsetFrom: 'text' })
    expect(result.borders!.children.map(child => typeof child !== 'string' && [child.localName, attrs(child)])).toEqual([
      ['top', { val: 'single', sz: '36', space: '28', color: 'auto', shadow: '0', frame: '0' }],
      ['right', { val: 'single', sz: '2', space: '1', color: '008000', shadow: '1', frame: '1' }],
    ])
  })
  it('supports explicit border removal, last record within its generation and an empty group without inventing a line', () => {
    expect(project([operation(0x522f, 32, 0)]).borders).toBeUndefined()
    const result = project([operation(0x702b, 24, 1, 1, 0), operation(0xd234, 8, 0, 0, 0, 0, 0, 0, 0, 0)])
    expect(attrs(result.borders!.children[0] as DocxXmlElementPlan).val).toBe('none')
    expect(attrs(project([operation(0x702b, 8, 1, 1, 0), operation(0x702b, 16, 3, 1, 0)]).borders!.children[0] as DocxXmlElementPlan).val).toBe('double')
  })
  it.each([
    operation(0xd234, 7, 0, 0, 0, 0, 8, 1, 0, 0), operation(0xd234, 8, 0, 0),
    operation(0xd234, 8, 0, 0, 0, 1, 8, 1, 0, 0), operation(0x702b, 8, 1, 17, 0),
    operation(0x522f, 3, 0), operation(0x522f, 16, 0), operation(0x522f, 64, 0), operation(0x522f, 0, 1),
  ])('rejects malformed records rather than relaxing compound-property validation', value => {
    expect(() => project([value])).toThrow(/Invalid|Incomplete/u)
  })
  it.each([5, 2, 64, 227])('keeps unadmitted border style %i explicit', style => {
    expect(() => project([operation(0xd234, 8, 0, 0, 0, 0, 8, style, 0, 0)])).toThrow(/border style/)
  })
  it('rejects unadmitted widths and still charges the normal XML budget', () => {
    expect(() => project([operation(0x702b, 97, 1, 1, 0)])).toThrow(/border width/)
    expect(() => project([operation(0x702b, 8, 1, 1, 0)], { maxXmlNodes: 10 })).toThrow(/limit/)
    expect(() => project([operation(0xd1ff, 1, 0)])).toThrow(/Compound section/)
  })
})

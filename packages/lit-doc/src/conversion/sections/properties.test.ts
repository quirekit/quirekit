import { describe, expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { createProjectionContext } from '../xml/context'
import { sectionProperties } from './properties'

/** @param opcode - Full source opcode. @param value - Sixteen-bit operand. @returns Independent operation vector. */
function word(opcode: number, value: number) { return { opcode, operand: Uint8Array.of(value & 255, value >>> 8 & 255) } }
/** @returns Fresh independent report and output budget. */
function context() { return createProjectionContext({}, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 }) }
/** @param element - Typed section property. @returns Exact attribute map. */
function attrs(element: DocxXmlElementPlan) { return Object.fromEntries(element.attributes.map(attribute => [attribute.localName, attribute.value])) }
const margins = [word(0xb021, 1800), word(0xb022, 1800), word(0x9023, 1440), word(0x9024, 1440), word(0xb017, 851), word(0xb018, 992), word(0x900c, 425)]

describe('independent section page tuples', () => {
  it('matches the native Word-produced page and grid values without selecting a UI preset', () => {
    const owner = context()
    const result = sectionProperties([...margins, word(0xb01f, 11906), word(0xb020, 16838), word(0x5032, 2), word(0x9031, 312)], owner, 'section:0')
    expect(result.children.filter(child => typeof child !== 'string').map(child => [child.localName, attrs(child)])).toEqual([
      ['type', { val: 'nextPage' }], ['pgSz', { w: '11906', h: '16838', orient: 'portrait' }],
      ['pgMar', { gutter: '0', left: '1800', right: '1800', top: '1440', bottom: '1440', header: '851', footer: '992' }],
      ['cols', { num: '1', equalWidth: '1', sep: '0', space: '425' }], ['vAlign', { val: 'top' }], ['docGrid', { type: 'lines', linePitch: '312' }],
    ])
    expect(owner.report.lossy).toBe(false)
  })
  it('retains signed fixed margins and does not rotate explicit sizes a second time', () => {
    const result = sectionProperties([...margins, word(0x9023, 0x10000 - 1440), word(0xb01f, 16838), word(0xb020, 11906), word(0x301d, 2)], context(), 'section:0')
    const elements = result.children.filter(child => typeof child !== 'string')
    expect(attrs(elements.find(child => child.localName === 'pgSz')!)).toMatchObject({ w: '16838', h: '11906', orient: 'landscape' })
    expect(attrs(elements.find(child => child.localName === 'pgMar')!).top).toBe('-1440')
  })
  it('does not infer required margins from the preceding section or an installation LCID', () => {
    expect(() => sectionProperties(margins.filter(operation => operation.opcode !== 0xb021), context(), 'section:1')).toThrow(/Required section margin/)
  })
  it('reports installation-dependent optional defaults and rejects missing enabled-grid pitch', () => {
    const owner = context()
    sectionProperties(margins.filter(operation => ![0xb017, 0xb018, 0x900c].includes(operation.opcode)), owner, 'section:0')
    expect(owner.report.diagnostics).toHaveLength(3); expect(owner.report.lossy).toBe(true)
    expect(() => sectionProperties([...margins, word(0x5032, 2)], context(), 'section:0')).toThrow(/requires line pitch/)
  })
  it.each([[0xb01f, 143], [0x301d, 0], [0x500b, 44], [0x5032, 4], [0x9031, 0]])('rejects invalid property %x value %i', (opcode, value) => {
    expect(() => sectionProperties([...margins, word(opcode!, value!)], context(), 'section:0')).toThrow(/Invalid/)
  })
})

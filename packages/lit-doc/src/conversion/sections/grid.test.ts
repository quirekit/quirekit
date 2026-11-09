import { describe, expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocConversionOptions } from '../types'
import { createProjectionContext } from '../xml/context'
import { sectionProperties } from './properties'

/** @param opcode - Section operation. @param value - Little-endian integer. @param width - Operand byte count. @returns Authored operation vector. */
function operation(opcode: number, value: number, width = 2) {
  return { opcode, operand: Uint8Array.from({ length: width }, (_, index) => value >>> (index * 8) & 255) }
}
/** @param options - Explicit output policy and budget. @returns Fresh section projection owner. */
function context(options: DocConversionOptions = { lossPolicy: 'best-effort' }) {
  return createProjectionContext(options, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 })
}
const margins = [0xb021, 0xb022, 0x9023, 0x9024, 0xb017, 0xb018, 0x900c].map(code => operation(code, 720))
/** @param operations - Ordered grid operations. @param owner - Policy and report. @returns Actual emitted grid attributes. */
function grid(operations: ReturnType<typeof operation>[], owner = context()) {
  const section = sectionProperties([...margins, ...operations], owner, 'section:2')
  const element = section.children.find(child => typeof child !== 'string' && child.localName === 'docGrid') as DocxXmlElementPlan
  return Object.fromEntries(element.attributes.map(attribute => [attribute.localName, attribute.value]))
}

describe('inactive source grid character-spacing compatibility', () => {
  it.each([[], [operation(0x5032, 0)], [operation(0x5032, 1), operation(0x5032, 0)]].map(modes => ({ modes })))(
    'omits a diagnosed invalid parameter only after the final mode is known: $modes', ({ modes }) => {
      const owner = context()
      expect(grid([operation(0x7030, 214742016, 4), operation(0x9031, 312), ...modes], owner)).toEqual({ type: 'default', linePitch: '312' })
      expect(owner.report.diagnostics).toEqual([{ code: 'inactive-grid-character-spacing-omitted', kind: 'loss', source: 'section:2',
        message: 'Out-of-range source character spacing 214742016 is omitted from the disabled document grid.' }])
      expect(owner.report.lossy).toBe(true)
    })
  it.each([-670925, -1, 0, 6488064])('retains legal explicit spacing %i even while the grid is disabled', spacing => {
    const owner = context()
    expect(grid([operation(0x7030, spacing, 4)], owner)).toEqual({ type: 'default', charSpace: String(spacing) })
    expect(owner.report.diagnostics).toEqual([])
  })
  it.each([1, 2, 3])('retains refusal of invalid spacing in enabled mode %i regardless of order', mode => {
    for (const operations of [[operation(0x7030, -670926, 4), operation(0x5032, mode)],
      [operation(0x5032, mode), operation(0x7030, 6488065, 4)],
      [operation(0x7030, 214742016, 4), operation(0x7030, 0, 4), operation(0x5032, mode)]])
      expect(() => grid([...operations, operation(0x9031, 312)])).toThrow(/Invalid grid character spacing/)
  })
  it.each([-670926, 6488065, 214742016])('keeps strict source refusal for malformed inactive spacing %i', spacing => {
    expect(() => grid([operation(0x7030, spacing, 4)], context({ lossPolicy: 'strict' }))).toThrow(/Invalid grid character spacing/)
  })
  it('honors the last parameter without resurrecting a superseded valid value', () => {
    const owner = context()
    expect(grid([operation(0x7030, 4096, 4), operation(0x7030, 214742016, 4)], owner)).toEqual({ type: 'default' })
    expect(owner.report.diagnostics).toHaveLength(1)
    const replaced = context()
    expect(grid([operation(0x7030, 214742016, 4), operation(0x7030, -4096, 4)], replaced)).toEqual({ type: 'default', charSpace: '-4096' })
    expect(replaced.report.diagnostics).toHaveLength(1)
  })
  it('keeps bounded diagnostics and rejects truncated operands or malformed independent grid fields', () => {
    expect(() => grid([operation(0x7030, -670926, 4), operation(0x7030, 6488065, 4)],
      context({ lossPolicy: 'best-effort', outputLimits: { maxDiagnostics: 1 } }))).toThrow(/diagnostic limit/)
    for (const value of [operation(0x7030, 0, 3), operation(0x5032, 4), operation(0x9031, 0)])
      expect(() => grid([value])).toThrow()
    expect(() => grid([operation(0x5032, 1)])).toThrow(/requires line pitch/)
  })
})

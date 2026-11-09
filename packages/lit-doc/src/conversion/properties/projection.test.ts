import { describe, expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { resolveLimits } from '../../binary/limits'
import { applyCharacterLayers } from '../../word/characters/formatting/apply'
import { defaultCharacterFormat } from '../../word/characters/formatting/defaults'
import type { CharacterPropertyKey } from '../../word/characters/formatting/types'
import { defaultParagraphFormat } from '../../word/paragraphs/formatting/defaults'
import type { WordFontRecord } from '../../word/fonts/types'
import { createPropertyReader } from '../../word/properties/reader'
import { createProjectionContext } from '../xml/context'
import { characterProperties } from './characters'
import { paragraphProperties } from './paragraphs'
import { colorRefValue, colorValue } from './values'

/** @returns Fresh independent projection counters and report. */
function context() { return createProjectionContext({}, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 }) }
/** @param element - Typed XML property. @returns Plain attribute map for exact normative expectations. */
function attributes(element: DocxXmlElementPlan) { return Object.fromEntries(element.attributes.map(attribute => [attribute.localName, attribute.value])) }
const fonts: WordFontRecord[] = ['Ascii', 'Other', '东亚', 'Complex'].map(name => ({ name, family: 0, pitch: 0, trueType: true, weight: 400, charset: 0, panose: Array(10).fill(0), signature: Array(6).fill(0) }))

describe('normative source property projection', () => {
  it.each([0, 1, 2, 255])('projects hint %i or explicitly reports the absent OOXML equivalent', scriptHint => {
    const format = { ...defaultCharacterFormat(0, { ascii: 0, other: 0, eastAsia: 0, complex: null }), scriptHint }
    const owner = context()
    const result = characterProperties(format, new Set(['scriptHint']), fonts, owner, 'direct')
    expect(result.map(element => [element.localName, attributes(element)]))
      .toEqual(scriptHint === 255 ? [] : [['rFonts', { hint: ['default', 'eastAsia', 'cs'][scriptHint] }]])
    expect(owner.report.lossy).toBe(scriptHint === 255)
    expect(owner.report.diagnostics).toEqual(scriptHint === 255 ? [expect.objectContaining({
      code: 'font-script-hint-unprojected', kind: 'loss', source: 'direct',
    })] : [])
  })

  it.each([0x4a30, 0x2a33])('projects a hint retained across source reset %i as an actual direct rFonts field', reset => {
    const baseline = defaultCharacterFormat(0, { ascii: 0, other: 0, eastAsia: 0, complex: null })
    const fields = new Set<CharacterPropertyKey>()
    const operation = reset === 0x4a30 ? { opcode: reset, operand: Uint8Array.of(15, 0) } : { opcode: reset, operand: Uint8Array.of(0) }
    const format = applyCharacterLayers(baseline, [[{ opcode: 0x286f, operand: Uint8Array.of(2) }, operation]],
      { paragraph: () => baseline, character: (paragraph, index) => ({ ...paragraph, characterStyleIndex: index }) },
      createPropertyReader(undefined, resolveLimits({})), fields)
    expect(characterProperties(format, fields, fonts, context(), 'direct')
      .map(element => [element.localName, attributes(element)])).toEqual([['rFonts', { hint: 'cs' }]])
  })

  it.each([0, 8, 9])('writes explicit outline %i without selecting a heading preset', outlineLevel => {
    const format = { ...defaultParagraphFormat(0), outlineLevel }
    const owner = context()
    expect(paragraphProperties(format, new Set(['outlineLevel']), owner, 'paragraph')
      .map(element => [element.localName, attributes(element)])).toEqual([['outlineLvl', { val: String(outlineLevel) }]])
    expect(paragraphProperties(format, new Set(), owner, 'inherited')).toEqual([])
    expect(owner.report.lossy).toBe(false)
  })
  it('keeps four font slots distinct and writes explicit false/zero only when actually direct', () => {
    const format = defaultCharacterFormat(0, { ascii: 0, other: 1, eastAsia: 2, complex: 3 })
    const result = characterProperties(format, new Set(['font:ascii', 'font:other', 'font:eastAsia', 'font:complex', 'bold', 'spacingTwips']), fonts, context(), 'test')
    expect(result.map(element => [element.localName, attributes(element)])).toEqual([
      ['rFonts', { ascii: 'Ascii', hAnsi: 'Other', eastAsia: '东亚', cs: 'Complex' }], ['b', { val: '0' }], ['spacing', { val: '0' }],
    ])
    expect(characterProperties(format, new Set(), fonts, context(), 'test')).toEqual([])
    const owner = context()
    characterProperties(format, new Set(['font:ascii', 'font:other']), fonts, owner, 'direct')
    expect(owner.report.diagnostics).toEqual([expect.objectContaining({ code: 'direct-high-ansi-font-host-limit', kind: 'host-limit' })])
    expect(owner.report.lossy).toBe(false)
  })
  it('encodes named-style toggle differences while direct false remains absolute', () => {
    const parent = defaultCharacterFormat(0, { ascii: 0, other: 0, eastAsia: 0, complex: null }); parent.bold = true
    const child = { ...parent, bold: false }
    expect(attributes(characterProperties(child, new Set(['bold']), fonts, context(), 'style', parent)[0]!)).toEqual({ val: '1' })
    expect(attributes(characterProperties(child, new Set(['bold']), fonts, context(), 'direct')[0]!)).toEqual({ val: '0' })
  })
  it('preserves automatic color, byte-order RGB and the independently documented dark-red palette value', () => {
    expect(colorRefValue(0xff123456)).toBe('auto')
    expect(colorRefValue(0x00332211)).toBe('112233')
    expect(colorValue({ encoding: 'palette', value: 13 })).toBe('800000')
  })
  it('does not turn a color-only underline operation into an enabled underline', () => {
    const format = defaultCharacterFormat(0, { ascii: 0, other: 0, eastAsia: 0, complex: null })
    format.underlineColorRef = 0x000000ff
    const owner = context()
    const result = characterProperties(format, new Set(['underlineColorRef']), fonts, owner, 'direct')
    expect(result.map(element => [element.localName, attributes(element)])).toEqual([['u', { val: 'none', color: 'FF0000' }]])
    expect(owner.report.lossy).toBe(true)
  })
  it('keeps first-line hanging, zero spacing and false pagination flags without projecting inherited values', () => {
    const format = defaultParagraphFormat(0); format.firstLineIndentTwips = -360
    const result = paragraphProperties(format, new Set(['keepLines', 'spacingBeforeTwips', 'firstLineIndentTwips']), context(), 'paragraph')
    expect(result.map(element => [element.localName, attributes(element)])).toEqual([
      ['keepLines', { val: '0' }], ['spacing', { before: '0' }], ['ind', { hanging: '360' }],
    ])
  })
  it('keeps physical compression distinct from distributed justification and reports the unproven Arabic mapping', () => {
    const format = defaultParagraphFormat(0); format.alignment = { value: 4, logical: false }
    const owner = context()
    expect(attributes(paragraphProperties(format, new Set(['alignment']), owner, 'paragraph')[0]!)).toEqual({ val: 'mediumKashida' })
    expect(owner.report.lossy).toBe(true)
  })
})

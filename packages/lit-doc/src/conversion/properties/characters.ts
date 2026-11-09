import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import type { DocCharacterBaseFormat, CharacterToggleField } from '../../word/characters/types'
import type { CharacterPropertyKey } from '../../word/characters/formatting/types'
import type { WordFontRecord } from '../../word/fonts/types'
import type { ProjectionContext } from '../xml/types'
import { colorRefValue, colorValue, languages, palette, underlines } from './values'

/** OOXML named-style Boolean properties use XOR; direct properties use absolute values. */
export const styleToggles = new Map<CharacterToggleField, string>([
  ['bold', 'b'], ['boldComplex', 'bCs'], ['italic', 'i'], ['italicComplex', 'iCs'], ['caps', 'caps'],
  ['smallCaps', 'smallCaps'], ['strike', 'strike'], ['doubleStrike', 'dstrike'], ['outline', 'outline'],
  ['shadow', 'shadow'], ['emboss', 'emboss'], ['imprint', 'imprint'], ['hidden', 'vanish'],
])
const literalBooleans = new Map<CharacterToggleField, string>([['noProof', 'noProof'], ['webHidden', 'webHidden'], ['rightToLeft', 'rtl'], ['complexScript', 'cs']])
const scalarElements = new Map<'spacingTwips' | 'scalePercent' | 'kerningHalfPoints' | 'positionHalfPoints' | 'fontSizeHalfPoints' | 'fontSizeComplexHalfPoints', string>([['spacingTwips', 'spacing'], ['scalePercent', 'w'],
  ['kerningHalfPoints', 'kern'], ['positionHalfPoints', 'position'], ['fontSizeHalfPoints', 'sz'], ['fontSizeComplexHalfPoints', 'szCs']])
const order = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline',
  'shadow', 'emboss', 'imprint', 'noProof', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'vertAlign', 'rtl', 'cs', 'em', 'lang']

/**
 * Projects only actual written fields, preserving false/zero and all source font slots.
 * @param format - Canonical source values after the owning layer.
 * @param fields - Semantic fields written by that layer.
 * @param fonts - Source font names, independent of installed fonts.
 * @param context - Bounded XML and loss-report owner.
 * @param source - Diagnostic authority.
 * @param parent - Named-style parent snapshot; absent for direct properties.
 * @returns Ordered rPr children without flattening inherited fields.
 */
export function characterProperties(format: DocCharacterBaseFormat, fields: ReadonlySet<CharacterPropertyKey>, fonts: readonly WordFontRecord[],
  context: ProjectionContext, source: string, parent?: DocCharacterBaseFormat): DocxXmlElementPlan[] {
  const e = context.element
  const result: DocxXmlElementPlan[] = []
  const fontAttributes: Record<string, string> = {}
  for (const [slot, name] of [['ascii', 'ascii'], ['other', 'hAnsi'], ['eastAsia', 'eastAsia'], ['complex', 'cs']] as const) {
    if (!fields.has(`font:${slot}`)) continue
    const index = format.fontIndexes[slot]
    if (index === null) continue
    requireDoc(fonts[index], 'invalid-formatting-data', 'Character font slot points outside the source font table')
    fontAttributes[name] = fonts[index].name
  }
  if (fields.has('scriptHint') && format.scriptHint !== 255) fontAttributes.hint = ['default', 'eastAsia', 'cs'][format.scriptHint]!
  if (fields.has('scriptHint') && format.scriptHint === 255) context.diagnose({ code: 'font-script-hint-unprojected', kind: 'loss', source,
    message: 'The source explicitly provides no script hint guidance, which has no OOXML hint equivalent; the hint is omitted.' })
  if (Object.keys(fontAttributes).length) result.push(e('rFonts', fontAttributes))
  if ((fields.has('font:ascii') || fields.has('font:other')) && format.fontIndexes.ascii !== format.fontIndexes.other)
    context.diagnose({ code: 'direct-high-ansi-font-host-limit', kind: 'host-limit', source,
      message: 'Distinct direct ASCII/hAnsi font slots are retained in OOXML; the current LitAST/Classic direct text-style model merges their native presentation.' })
  for (const [field, name] of styleToggles) {
    if (!fields.has(field)) continue
    if (parent && format[field] === parent[field]) continue
    result.push(e(name, { val: parent || format[field] ? '1' : '0' }))
  }
  for (const [field, name] of literalBooleans) if (fields.has(field) && format[field] !== null) result.push(e(name, { val: format[field] ? '1' : '0' }))
  for (const [field, name] of scalarElements) if (fields.has(field) && format[field] !== null) result.push(e(name, { val: String(format[field]) }))
  if (fields.has('fontSizeHalfPoints') && format.fontSizeHalfPoints === 0) {
    context.diagnose({ code: 'zero-font-size-unportable', kind: 'loss', source,
      message: 'The explicit zero size is retained as producer XML; its portable Word-compatible font-size effect is not admitted.' })
    context.diagnose({ code: 'zero-font-size-host-limit', kind: 'host-limit', source,
      message: 'Zero size is preserved through the run-property envelope; the current Classic model and authoring controls do not interpret it as an editable or rendered zero font size.' })
  }
  if (fields.has('color')) result.push(e('color', { val: colorValue(format.color) }))
  if (fields.has('underline') || fields.has('underlineColorRef')) result.push(e('u', {
    val: underlines.get(format.underline)!,
    ...(fields.has('underlineColorRef') ? { color: colorRefValue(format.underlineColorRef) } : {}),
  }))
  if (fields.has('underlineColorRef') && !fields.has('underline')) context.diagnose({ code: 'underline-color-coupling-approximated', kind: 'approximation', source,
    message: 'OOXML underline color shares one element with underline kind; the current kind is retained with the color.' })
  if (fields.has('highlight')) result.push(e('highlight', { val: ['none', 'black', 'blue', 'cyan', 'green', 'magenta', 'red', 'yellow', 'white',
    'darkBlue', 'darkCyan', 'darkGreen', 'darkMagenta', 'darkRed', 'darkYellow', 'darkGray', 'lightGray'][format.highlight]! }))
  if (fields.has('verticalAlign')) result.push(e('vertAlign', { val: ['baseline', 'superscript', 'subscript'][format.verticalAlign]! }))
  if (fields.has('emphasis')) result.push(e('em', { val: ['none', 'dot', 'comma', 'circle', 'underDot'][format.emphasis]! }))
  const languageAttributes: Record<string, string> = {}
  for (const [field, name] of [['language', 'val'], ['languageEastAsia', 'eastAsia'], ['languageComplex', 'bidi']] as const) {
    if (!fields.has(field)) continue
    const value = format[field]
    if (value === 0 && source === 'defaults:character') continue
    const tag = languages.get(value)
    if (tag) languageAttributes[name] = tag
    else context.diagnose({ code: 'language-unprojected', kind: 'loss', source, message: `LCID ${value} has no admitted OOXML language mapping; the field is omitted.` })
  }
  if (Object.keys(languageAttributes).length) result.push(e('lang', languageAttributes))
  if (fields.has('colorComplex') && format.colorComplex !== null && palette[format.colorComplex] !== colorValue(format.color))
    context.diagnose({ code: 'complex-script-color-unprojected', kind: 'loss', source, message: 'Independent complex-script color cannot be represented by one OOXML run color; the ordinary color is retained.' })
  for (const field of ['special', 'inserted', 'deleted', 'fieldHidden'] as const) if (fields.has(field) && format[field])
    context.diagnose({ code: `${field}-unprojected`, kind: 'loss', source, message: `Source ${field} state requires its object/revision authority and is not recreated by base formatting.` })
  return result.sort((left, right) => order.indexOf(left.localName) - order.indexOf(right.localName))
}

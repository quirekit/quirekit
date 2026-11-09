import { requireDoc } from '../../../../errors'
import type { PropertyReader } from '../../../properties/types'
import type { CharacterToggleField, DocCharacterBaseFormat } from '../../types'
import type { CharacterMajorityContext, CharacterPropertyKey, CharacterToggleModes } from '../types'
import { colorValue } from '../color'
import { readMajoritySelection } from './selection'

const properties = ['bold', 'italic', 'smallCaps', 'hidden', 'boldComplex', 'italicComplex', 'strike', 'caps', 'shadow', 'outline',
  'doubleStrike', 'emboss', 'imprint', 'noProof', 'fontSizeHalfPoints', 'fontSizeComplexHalfPoints', 'positionHalfPoints',
  'verticalAlign', 'emphasis', 'underline', 'spacingTwips', 'language', 'languageEastAsia', 'languageComplex'] as const

/** @param target - Private current settings. @param paragraph - Immutable paragraph baseline. @param field - One homogeneous scalar field. */
function restore<Field extends typeof properties[number]>(target: DocCharacterBaseFormat, paragraph: DocCharacterBaseFormat, field: Field): void {
  target[field] = paragraph[field]
}

/** @param target - Private current settings. @param paragraph - Immutable paragraph baseline. @param slot - One source font slot. */
function restoreFont<Slot extends keyof DocCharacterBaseFormat['fontIndexes']>(target: DocCharacterBaseFormat, paragraph: DocCharacterBaseFormat, slot: Slot): void {
  target.fontIndexes[slot] = paragraph.fontIndexes[slot]
}

/**
 * Applies the source's selection before restoring affected fields, without clearing unrelated settings.
 * @param target - Private current character state.
 * @param paragraph - Immutable underlying paragraph text properties.
 * @param operand - Exact counted comparison group.
 * @param reader - Shared source work budget.
 * @param context - Immutable source defaults and font-name authority.
 * @param fields - Optional surviving direct provenance.
 * @param modes - Optional surviving relative-toggle provenance.
 */
export function applyCharacterMajority(target: DocCharacterBaseFormat, paragraph: DocCharacterBaseFormat, operand: Uint8Array,
  reader: PropertyReader, context: CharacterMajorityContext, fields?: Set<CharacterPropertyKey>, modes?: CharacterToggleModes): void {
  const selection = readMajoritySelection(operand, context.defaults, reader)
  if (target.characterStyleIndex !== 10) return
  requireDoc(!target.unsupportedOpcodes.includes(0x2859) && !paragraph.unsupportedOpcodes.includes(0x2859),
    'unsupported-formatting', 'Majority cannot reset an unresolved text animation')

  // First select against one immutable current snapshot. In particular, a font
  // lookup or unresolved automatic comparison must fail before any restoration.
  const selected: (typeof properties[number])[] = []
  for (const field of properties) {
    if (target[field] !== selection[field]) {
      requireDoc(target[field] !== null && selection[field] !== null, 'unsupported-formatting', 'Majority cannot compare unresolved automatic character properties')
      continue
    }
    if (field !== 'noProof' || target.noProof !== true) selected.push(field)
  }
  const fonts: (keyof DocCharacterBaseFormat['fontIndexes'])[] = []
  for (const slot of ['ascii', 'eastAsia', 'other', 'complex'] as const) {
    const current = target.fontIndexes[slot], wanted = selection.fontIndexes[slot]
    if (current !== wanted) {
      requireDoc(current !== null && wanted !== null, 'unsupported-formatting', 'Majority cannot compare an unresolved automatic font')
      continue
    }
    if (slot === 'eastAsia' && current !== paragraph.fontIndexes.eastAsia) {
      requireDoc(context.fontName, 'unsupported-formatting', 'Majority East Asian font reset requires source font names')
      const name = context.fontName(paragraph.fontIndexes.eastAsia)
      requireDoc(typeof name === 'string' && name.length > 0, 'unsupported-formatting', 'Majority target font name is unavailable')
      if (name.toLowerCase() === 'times new roman') continue
    }
    fonts.push(slot)
  }
  const color = colorValue(target.color) === colorValue(selection.color)

  // Restoration removes only obsolete direct/inverse provenance. Subsequent
  // source operations can establish new direct values in the same layer.
  for (const field of selected) {
    restore(target, paragraph, field); fields?.delete(field); modes?.delete(field as CharacterToggleField)
  }
  for (const slot of fonts) { restoreFont(target, paragraph, slot); fields?.delete(`font:${slot}`) }
  if (color) { target.color = { ...paragraph.color }; fields?.delete('color') }
}

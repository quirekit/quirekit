import { requireDoc } from '../../errors'
import { applyCharacterLayers } from '../../word/characters/formatting/apply'
import { copyCharacterFormat } from '../../word/characters/formatting/defaults'
import type { CharacterPropertyKey, CharacterToggleModes } from '../../word/characters/formatting/types'
import { validateCharacterFormat } from '../../word/characters/formatting/values'
import type { DocNumberingLevel } from '../../word/numbering/types'
import { applyParagraphProperties } from '../../word/paragraphs/formatting/apply'
import { copyParagraphFormat } from '../../word/paragraphs/formatting/defaults'
import type { ParagraphPropertyKey } from '../../word/paragraphs/formatting/types'
import type { NumberingLevelContext, NumberingPropertyValues } from './types'

/**
 * Validates source deltas without creating XML or declaring any field retained.
 * @param level - Original PAPX and CHPX payloads.
 * @param styleIndex - Valid linked paragraph style, or the normal baseline.
 * @param context - Shared source interpreters and graph-local semantic cache.
 * @returns Canonical values and surviving local provenance.
 */
export function readNumberingPropertyValues(level: DocNumberingLevel, styleIndex: number, context: NumberingLevelContext): NumberingPropertyValues {
  const { source, characters } = context
  const { reader } = source.context
  const paragraph = copyParagraphFormat(source.paragraphStyles.resolve(styleIndex))
  paragraph.unsupportedOpcodes = []
  const paragraphFields = new Set<ParagraphPropertyKey>()
  const pOperations = reader.read(level.paragraphProperties)
  requireDoc(pOperations.every(operation => (operation.opcode >>> 10 & 7) === 1),
    'invalid-formatting-data', 'Numbering paragraph payload contains a non-paragraph operation')
  requireDoc(!pOperations.some(operation => operation.opcode === 0x460b || operation.opcode === 0x260a),
    'unsupported-numbering', 'Numbering level properties cannot introduce recursive list references')
  applyParagraphProperties(paragraph, pOperations, reader, paragraphFields)
  const characterFields = new Set<CharacterPropertyKey>()
  const toggles: CharacterToggleModes = new Map()
  const baseline = copyCharacterFormat(characters.paragraph(styleIndex))
  baseline.unsupportedOpcodes = []
  const cOperations = reader.read(level.characterProperties)
  requireDoc(cOperations.every(operation => (operation.opcode >>> 10 & 7) === 2),
    'invalid-formatting-data', 'Numbering marker payload contains a non-character operation')
  const character = applyCharacterLayers(baseline, [cOperations], characters, reader, characterFields, toggles)
  validateCharacterFormat(character)
  for (const slot of ['ascii', 'other', 'eastAsia', 'complex'] as const) {
    const index = character.fontIndexes[slot]
    requireDoc(!characterFields.has(`font:${slot}`) || index === null || source.fonts[index],
      'invalid-formatting-data', 'Numbering marker font slot points outside the source font table')
  }
  return { paragraph, paragraphFields, character, characterFields, toggles }
}

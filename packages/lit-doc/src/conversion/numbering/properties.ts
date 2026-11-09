import { characterProperties } from '../properties/characters'
import { paragraphProperties } from '../properties/paragraphs'
import { styleId } from '../styles/identity'
import type { NumberingLevelContext, NumberingPropertyValues } from './types'

/**
 * Reuses the canonical property interpreters while preserving each level's own deltas.
 * @param values - Fully validated source deltas from the shared interpreters.
 * @param authority - Located definition or override name.
 * @param context - Shared source interpreters and output budgets.
 * @returns Independent level pPr and marker rPr children.
 */
export function numberingProperties(values: NumberingPropertyValues, authority: string, context: NumberingLevelContext) {
  const { source, xml } = context
  const { paragraph, paragraphFields, character, toggles } = values
  const characterFields = new Set(values.characterFields)
  // Relative inheritance cannot be baked into one shared marker value. Inverse
  // values need a future contextual contract rather than a fabricated default.
  for (const [field, mode] of toggles) if (mode >= 0x80) {
    characterFields.delete(field)
    if (mode === 0x81) xml.diagnose({ code: 'numbering-inverse-toggle-unprojected', kind: 'loss', source: authority,
      message: `Inverse-style marker ${field} cannot be represented across all paragraph contexts and is omitted.` })
  }
  const pPr = paragraphProperties(paragraph, paragraphFields, xml, authority)
  const rPr = characterProperties(character, characterFields, source.fonts, xml, authority)
  if (character.characterStyleIndex !== 10) {
    rPr.unshift(xml.element('rStyle', { val: styleId(character.characterStyleIndex) }))
    xml.diagnose({ code: 'numbering-character-style-host-limit', kind: 'host-limit', source: authority,
      message: 'The marker character-style reference is retained in OOXML; current Classic marker editing does not cover it.' })
  }
  const codes = [...new Set([...paragraph.unsupportedOpcodes, ...character.unsupportedOpcodes])]
  if (codes.length) xml.diagnose({ code: 'source-properties-unprojected', kind: 'loss', source: authority,
    message: `Source operations ${codes.map(code => `0x${code.toString(16)}`).join(', ')} are outside the admitted OOXML projection.` })
  if (pPr.some(value => value.localName !== 'ind') || rPr.length)
    xml.diagnose({ code: 'numbering-properties-host-limit', kind: 'host-limit', source: authority,
      message: 'Source level properties are retained in OOXML; complete marker and paragraph presentation requires separate LitAST/Classic field coverage.' })
  return { pPr, rPr }
}

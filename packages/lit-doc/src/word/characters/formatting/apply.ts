import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { DocReadDiagnostic } from '../../../types'
import type { PropertyOperation, PropertyReader } from '../../properties/types'
import type { DocCharacterBaseFormat } from '../types'
import { copyCharacterFormat } from './defaults'
import type { CharacterMajorityContext, CharacterPropertyKey, CharacterStyleResolver, CharacterToggleModes } from './types'
import { applyCharacterValue } from './values'
import { characterToggleField } from './toggles'
import { applyCharacterMajority } from './majority/apply'

const preserved = new Set<CharacterPropertyKey>(['highlight', 'rightToLeft', 'complexScript',
  'special', 'inserted', 'deleted', 'fieldHidden', 'webHidden', 'scriptHint'])

/**
 * Applies direct and piece layers in order, updating the style snapshot only at actual resets.
 * @param paragraph - Immutable underlying paragraph text properties.
 * @param layers - CHPX followed by the current piece's character modifications.
 * @param styles - Source character style compiler.
 * @param reader - Shared operation budget.
 * @param fields - Optional provenance sink for surviving direct fields.
 * @param toggleModes - Optional last-operation metadata for relative inheritance projection.
 * @param diagnostics - Optional inspection-owned compatibility sink.
 * @param majority - Optional immutable document defaults and source font identity.
 * @returns Independent completed run settings.
 */
export function applyCharacterLayers(paragraph: DocCharacterBaseFormat, layers: readonly (readonly PropertyOperation[])[],
  styles: CharacterStyleResolver, reader: PropertyReader, fields?: Set<CharacterPropertyKey>, toggleModes?: CharacterToggleModes,
  diagnostics?: DocReadDiagnostic[], majority?: CharacterMajorityContext): DocCharacterBaseFormat {
  let style = paragraph
  let result = copyCharacterFormat(paragraph)
  for (const operations of layers) {
    reader.consume(operations.length)
    for (const operation of operations) {
      if (operation.opcode === 0xca47) {
        requireDoc(majority, 'unsupported-formatting', 'Character majority requires source document defaults')
        applyCharacterMajority(result, paragraph, operation.operand, reader, majority, fields, toggleModes)
      } else if (operation.opcode === 0x4a30 || operation.opcode === 0x2a33) {
        const source = new ByteView(operation.operand, 'invalid-formatting-data')
        if (operation.opcode === 0x2a33) requireDoc(source.u8(0) === 0, 'invalid-formatting-data', 'Invalid clear-character-format operand')
        const next = operation.opcode === 0x2a33 ? paragraph : styles.character(paragraph, source.u16(0))
        const previous = result
        result = copyCharacterFormat(next)
        // Both source resets preserve mandated hints and state independently of
        // the new style baseline. Automatic direction must not become false.
        result.highlight = previous.highlight
        result.scriptHint = previous.scriptHint
        result.rightToLeft = previous.rightToLeft; result.complexScript = previous.complexScript
        result.special = previous.special; result.inserted = previous.inserted; result.deleted = previous.deleted
        result.fieldHidden = previous.fieldHidden; result.webHidden = previous.webHidden
        result.unsupportedOpcodes = [...new Set([...previous.unsupportedOpcodes, ...result.unsupportedOpcodes])].sort((a, b) => a - b)
        if (fields) for (const field of fields) if (!preserved.has(field)) fields.delete(field)
        if (toggleModes) for (const field of toggleModes.keys()) if (!preserved.has(field)) toggleModes.delete(field)
        style = next
      } else {
        const field = applyCharacterValue(result, style, operation, diagnostics)
        if (field) fields?.add(field)
        const toggle = toggleModes && characterToggleField(operation.opcode)
        if (toggle) toggleModes!.set(toggle, operation.operand[0] as 0 | 1 | 0x80 | 0x81)
      }
    }
  }
  return result
}

import { requireDoc } from '../../../errors'
import type { DocReadDiagnostic } from '../../../types'
import type { PropertyOperation } from '../../properties/types'
import type { DocCharacterBaseFormat } from '../types'
import { applyCharacterScalar } from './scalars'
import { applyCharacterToggle } from './toggles'
import type { CharacterPropertyKey } from './types'

const outsideScope = new Set([0x6a03, 0x4804, 0x6805, 0x0806, 0x4807, 0x6a09, 0x080a,
  0x6815, 0x6816, 0x6817, 0x0818, 0xc81a, 0x484e, 0x0856, 0xca57, 0x2859, 0xca62,
  0x4863, 0x6864, 0x6865, 0x4866, 0x4867, 0x0868, 0x486b, 0xca71, 0xca72, 0xca76, 0xca78,
  0x2879, 0x2a83, 0xca85, 0x2a86, 0x6887, 0x4888, 0xca89, 0x2a90])

/**
 * Applies one non-style operation, diagnosing ordinary unsupported fields and rejecting unknown resets.
 * @param target - Independent current settings.
 * @param style - Stable style snapshot used by relative toggles.
 * @param operation - Bounded source operation.
 * @param diagnostics - Optional inspection-owned compatibility sink.
 * @returns Written semantic field, or undefined for an outside-scope property.
 */
export function applyCharacterValue(target: DocCharacterBaseFormat, style: DocCharacterBaseFormat, operation: PropertyOperation,
  diagnostics?: DocReadDiagnostic[]): CharacterPropertyKey | undefined {
  const field = applyCharacterToggle(target, style, operation, diagnostics) ?? applyCharacterScalar(target, operation, diagnostics)
  if (field) return field
  const group = operation.opcode >>> 10 & 7
  requireDoc(group >= 1 && group <= 5 && (group !== 2 || outsideScope.has(operation.opcode)),
    'unsupported-formatting', `Unsupported character formatting operation 0x${operation.opcode.toString(16)}`)
  target.unsupportedOpcodes = [...new Set([...target.unsupportedOpcodes, operation.opcode])].sort((a, b) => a - b)
  return undefined
}

/**
 * Checks effect combinations after the complete ordered operation sequence.
 * @param format - Completed run settings.
 */
export function validateCharacterFormat(format: DocCharacterBaseFormat): void {
  requireDoc(!(format.emboss && (format.imprint || format.outline || format.shadow))
    && !(format.imprint && (format.outline || format.shadow)), 'invalid-formatting-data', 'Incompatible character effects')
}

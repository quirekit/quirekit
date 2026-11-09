import { requireDoc } from '../../../errors'
import type { DocReadDiagnostic } from '../../../types'
import type { PropertyOperation } from '../../properties/types'
import type { CharacterToggleField, DocCharacterBaseFormat } from '../types'

const fields = new Map<number, CharacterToggleField>([
  [0x0835, 'bold'], [0x0836, 'italic'], [0x0837, 'strike'], [0x2a53, 'doubleStrike'],
  [0x0838, 'outline'], [0x0839, 'shadow'], [0x083a, 'smallCaps'], [0x083b, 'caps'],
  [0x083c, 'hidden'], [0x0858, 'emboss'], [0x0854, 'imprint'], [0x085c, 'boldComplex'],
  [0x085d, 'italicComplex'], [0x0875, 'noProof'], [0x085a, 'rightToLeft'], [0x0882, 'complexScript'],
  [0x0855, 'special'], [0x0801, 'inserted'], [0x0800, 'deleted'], [0x0802, 'fieldHidden'], [0x0811, 'webHidden'],
])

const notedImplicitRtl = new WeakSet<DocReadDiagnostic[]>()

/**
 * Identifies toggle operations through the same authoritative source opcode registry.
 * @param opcode - Full source property modifier.
 * @returns Semantic toggle field, or undefined for another property family.
 */
export function characterToggleField(opcode: number): CharacterToggleField | undefined { return fields.get(opcode) }

/**
 * Applies four-valued source toggles relative to a stable style snapshot.
 * @param target - Current independent settings.
 * @param style - Current style settings before this direct layer.
 * @param operation - One bounded operation.
 * @param diagnostics - Optional inspection-owned compatibility sink.
 * @returns Written semantic field, or undefined for a different operation.
 */
export function applyCharacterToggle(target: DocCharacterBaseFormat, style: DocCharacterBaseFormat, operation: PropertyOperation,
  diagnostics?: DocReadDiagnostic[]): CharacterToggleField | undefined {
  const field = fields.get(operation.opcode)
  if (!field) return undefined
  const value = operation.operand[0]!
  requireDoc([0, 1, 0x80, 0x81].includes(value), 'invalid-formatting-data', 'Invalid character toggle operand')
  const inherited = style[field]
  // Only the inverse RTL operation needs the unset stored style flag. Keep
  // automatic direction intact for ordinary inheritance and other properties.
  const implicitRtl = field === 'rightToLeft' && value === 0x81 && inherited === null
  requireDoc(value !== 0x81 || inherited !== null || implicitRtl, 'unsupported-formatting', 'Cannot invert an unresolved automatic character property')
  if (implicitRtl && diagnostics && !notedImplicitRtl.has(diagnostics)) {
    notedImplicitRtl.add(diagnostics)
    diagnostics.push({ code: 'implicit-rtl-style-inversion',
      message: 'An inverse RTL operation uses the unset stored style flag as false; ordinary automatic direction remains unresolved.' })
  }
  const result = value === 0 ? false : value === 1 ? true : value === 0x80 ? inherited : !inherited
  if (field === 'rightToLeft' || field === 'complexScript') target[field] = result
  else {
    requireDoc(result !== null, 'invalid-formatting-data', 'Unexpected automatic Boolean character property')
    target[field] = result
  }
  return field
}

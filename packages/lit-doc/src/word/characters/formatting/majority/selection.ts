import { requireDoc } from '../../../../errors'
import type { PropertyReader } from '../../../properties/types'
import type { DocCharacterBaseFormat } from '../../types'
import { copyCharacterFormat } from '../defaults'
import { applyCharacterValue, validateCharacterFormat } from '../values'

/** @param operand - Exact counted comparison group. @param defaults - Immutable source defaults. @param reader - Shared parse/application budget. @returns Independently compiled and validated comparison values. */
export function readMajoritySelection(operand: Uint8Array, defaults: DocCharacterBaseFormat, reader: PropertyReader): DocCharacterBaseFormat {
  requireDoc(operand.length > 0 && operand[0] === operand.length - 1, 'invalid-formatting-data', 'Invalid character majority comparison envelope')
  const operations = reader.read(operand.subarray(1)), result = copyCharacterFormat(defaults)
  reader.consume(operations.length)
  for (const operation of operations) {
    requireDoc((operation.opcode >>> 10 & 7) === 2, 'unsupported-formatting', 'Majority comparisons require ordinary character properties')
    applyCharacterValue(result, defaults, operation)
  }
  requireDoc(result.unsupportedOpcodes.length === 0, 'unsupported-formatting', 'Majority comparison contains an unimplemented character property')
  requireDoc(result.fontSizeHalfPoints !== 0, 'unsupported-formatting', 'Majority cannot compare a nonportable zero font size')
  validateCharacterFormat(result)
  return result
}

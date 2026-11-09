import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'

/**
 * Validates the old counted descriptor without inventing a modern list instance.
 * @param operand - Complete sprmPAnld80 operand, including its byte-count prefix.
 */
export function validateLegacyNumberingDescriptor(operand: Uint8Array): void {
  const value = new ByteView(operand, 'invalid-formatting-data')
  // ANLD80 excludes the later color field. Its two text lengths address one
  // fixed UTF-16 slot; expanded ANLD and truncated records cannot share this path.
  requireDoc(operand.length === 85 && value.u8(0) === 84,
    'invalid-formatting-data', 'Invalid legacy Word numbering descriptor length')
  requireDoc(value.u8(2) + value.u8(3) <= 32,
    'invalid-formatting-data', 'Legacy numbering text exceeds its fixed storage')
}

import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { PropertyOperation } from '../properties/types'

/**
 * Validates row history metadata independently of the complete current-value operation stream.
 * @param operations - Ordered direct PAPX and piece properties.
 * @returns Whether a final checkpoint or property-revision mark requires history preservation.
 */
export function hasTablePropertyRevision(operations: readonly PropertyOperation[]): boolean {
  let retained = false, marked = false
  for (const { opcode, operand } of operations) {
    if (opcode !== 0x3668 && opcode !== 0xd667) continue
    const source = new ByteView(operand, 'invalid-table-data')
    if (opcode === 0x3668) {
      requireDoc(operand.length === 1 && source.u8(0) <= 1, 'invalid-table-data', 'Invalid table property-revision checkpoint')
      retained = source.u8(0) === 1
    } else {
      requireDoc(operand.length === 8 && source.u8(0) === 7 && source.u8(1) <= 1,
        'invalid-table-data', 'Invalid table property-revision mark envelope')
      marked = source.u8(1) === 1
    }
  }
  return retained || marked
}

import { ByteView } from '../../binary/bytes'
import { DocReadError, requireDoc } from '../../errors'

/**
 * Reads a whole operand, allowing only a known structural property's malformed tail to stop a list.
 * @param source - Exact bounded property bytes.
 * @param position - Operand start after a complete opcode.
 * @param opcode - Full source opcode.
 * @param recover - Whether conversion permits local structural-prefix recovery.
 * @returns Complete original operand, or undefined when the remainder must be omitted.
 */
export function readPropertyOperand(source: ByteView, position: number, opcode: number, recover: boolean): Uint8Array | undefined {
  try {
    let operand = source.slice(position, operandLength(source, position, opcode))
    if (recover && opcode === 0xd608) {
      requireDoc(operand.length >= 3, 'invalid-formatting-data', 'Table property omits its column-count byte')
      // A complete terminal TC80 array can have a one-byte-short length prefix.
      // Both the column count and the exact group end must independently agree,
      // so this exception can neither fabricate a byte nor consume another Prl.
      const columns = operand[2]!
      const complete = 3 + (columns + 1) * 2 + columns * 20
      if (columns <= 63 && complete === operand.length + 1 && position + complete === source.bytes.length)
        operand = source.slice(position, complete)
    }
    return operand
  } catch (error) {
    const family = opcode >>> 10 & 7
    if (recover && [1, 4, 5].includes(family) && error instanceof DocReadError && error.code === 'invalid-formatting-data') return undefined
    throw error
  }
}

/**
 * Determines a complete operand size without interpreting the property's value.
 * @param source - Bounded property list.
 * @param position - Operand start after the opcode.
 * @param opcode - Full property code.
 * @returns Operand byte count, including any length prefix.
 */
export function operandLength(source: ByteView, position: number, opcode: number): number {
  const kind = opcode >>> 13
  if (kind !== 6) return [1, 1, 2, 4, 2, 2, 0, 3][kind]!
  if (opcode === 0xd608) {
    const size = source.u16(position)
    requireDoc(size >= 1, 'invalid-formatting-data', 'Table property length must include its count byte')
    return size + 1
  }
  const size = source.u8(position)
  if (opcode !== 0xc615 || size !== 255) return size + 1
  const removed = source.u8(position + 1)
  requireDoc(removed <= 64, 'invalid-formatting-data', 'Too many removed tab stops')
  const added = source.u8(position + 2 + removed * 4)
  requireDoc(added <= 64, 'invalid-formatting-data', 'Too many added tab stops')
  return 3 + removed * 4 + added * 3
}

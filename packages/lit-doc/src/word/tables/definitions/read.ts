import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { PropertyOperation } from '../../properties/types'
import type { RowDefinitionChange } from './types'

/**
 * Evaluates only the operations that change the number of source cell definitions.
 * @param operations - Ordered direct row operations.
 * @returns Final declared cell count, independent of the observed text markers.
 */
export function readRowDefinitionCount(operations: readonly PropertyOperation[]): number {
  let count = 0
  for (const operation of operations) count = readRowDefinitionChange(operation, count)?.count ?? count
  return count
}

/**
 * Decodes structure once for both membership validation and optional cell geometry.
 * @param operation - Exact direct row operation with its bounded operand.
 * @param count - Number of definitions established by preceding operations.
 * @returns Typed structural change, or null for a property outside this family.
 */
export function readRowDefinitionChange(operation: PropertyOperation, count: number): RowDefinitionChange | null {
  const { opcode, operand } = operation
  const value = new ByteView(operand, 'invalid-table-data')
  if (opcode === 0xd608) {
    count = value.u8(2)
    const end = 3 + (count + 1) * 2
    requireDoc(count <= 63 && operand.length >= end && (operand.length - end) % 20 === 0,
      'invalid-table-data', 'Invalid initial table-cell definitions')
    let previous = -31681
    const edges: number[] = []
    for (let i = 0; i <= count; i++) {
      const raw = value.u16(3 + i * 2)
      const edge = raw >= 0x8000 ? raw - 0x10000 : raw
      requireDoc(edge >= previous && Math.abs(edge) <= 31680, 'invalid-table-data', 'Invalid table-cell edge order or range')
      previous = edge
      edges.push(edge)
    }
    const cells = Array.from({ length: Math.min(count, (operand.length - end) / 20) }, (_, index) => value.slice(end + index * 20, 20))
    return { kind: 'initial', count, edges, cells }
  } else if (opcode === 0x7621) {
    const at = value.u8(0); const inserted = value.u8(1)
    requireDoc(at <= count && inserted > 0 && count + inserted <= 63 && value.u16(2) <= 31680,
      'invalid-table-data', 'Invalid table-cell definition insertion')
    return { kind: 'insert', count: count + inserted, at, inserted, width: value.u16(2) }
  } else if (opcode === 0x5622) {
    const first = value.u8(0); const end = value.u8(1)
    requireDoc(first < count && first <= end && end <= count && end - first < count,
      'invalid-table-data', 'Invalid table-cell definition deletion')
    return { kind: 'delete', count: count - (end - first), first, end }
  }
  return null
}

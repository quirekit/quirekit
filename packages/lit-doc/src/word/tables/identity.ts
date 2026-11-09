import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { PropertyOperation } from '../properties/types'
import type { WordStyleRecord } from '../styles/types'
import { tablePositionOpcodes } from './position'
import type { DocTableIdentity } from './types'
import { hasTablePropertyRevision } from './revisions'

const knownTableProperties = new Set([
  0x5400, 0x9601, 0x9602, 0x3403, 0x3404, 0xd605, 0x9407, 0xd608,
  0xd609, 0x740a, 0x560b, 0xd60c, 0x360d, 0x940e, 0x940f, 0x9410,
  0x9411, 0xd612, 0xd613, 0xf614, 0x3615, 0xd616, 0xf617, 0xf618,
  0x3619, 0xd61a, 0xd61b, 0xd61c, 0xd61d, 0x941e, 0x941f, 0xd620,
  0x7621, 0x5622, 0x7623, 0x5624, 0x5625, 0x7629, 0xd62b, 0xd62c,
  0xd62d, 0xd62e, 0xd62f, 0xd632, 0xd633, 0xd634, 0xd635, 0xf636,
  0xd639, 0x563a, 0xd63e, 0xd642, 0xd660, 0xf661, 0xd662, 0x5664,
  0x3465, 0x3466, 0xd667, 0x3668, 0x7469, 0xd66a, 0xd670, 0xd671,
  0xd672, 0x7479, 0x347c, 0x347d, 0xd47f, 0xd680, 0xd681, 0xd682,
  0xd683, 0xd684, 0xd685, 0xd686, 0xd687, 0x3488, 0x3489, 0x548a,
])
const admitted = new Set([0x2416, 0x2417, 0x6649, 0x664a, 0x244b, 0x244c, 0xd608, 0x7621, 0x5622, 0x563a, 0x7469, 0x560b, 0x5664, 0xd667, 0x3668])

/**
 * Rejects unresolved boundaries and unknown structural operations before grouping any rows.
 * @param operations - One table paragraph's direct properties.
 */
export function validateTableOperations(operations: readonly PropertyOperation[]): void {
  hasTablePropertyRevision(operations)
  for (const { opcode } of operations) {
    requireDoc(opcode !== 0xd66a, 'unsupported-table', 'Conditional table properties require table-style projection')
    requireDoc((opcode >>> 10 & 7) !== 5 || knownTableProperties.has(opcode),
      'unsupported-table', `Unknown table property 0x${opcode.toString(16)}`)
  }
}

/**
 * Resolves only adjacent-row identity; style internals cannot define source cell membership.
 * @param operations - Ordered row authority.
 * @param styles - Lazy source stylesheet, read only when a table style occurs.
 * @returns Identity with explicit absent values and the normative combined direction.
 */
export function readTableIdentity(operations: readonly PropertyOperation[], styles: () => readonly (WordStyleRecord | undefined)[]): DocTableIdentity {
  let styleIndex: number | null = null; let group: number | null = null
  let bidi = false; let oldBidi = false
  for (const { opcode, operand } of operations) {
    const value = new ByteView(operand, 'invalid-table-data')
    if (opcode === 0x563a) {
      const index = value.u16(0)
      styleIndex = styles()[index]?.kind === 3 ? index : 11
    } else if (opcode === 0x7469) group = value.u32(0)
    else if (opcode === 0x560b || opcode === 0x5664) {
      requireDoc(value.u16(0) <= 1, 'invalid-table-data', 'Invalid table direction Boolean')
      if (opcode === 0x560b) bidi = value.u16(0) === 1
      else oldBidi = value.u16(0) === 1
    }
  }
  return { styleIndex, group, bidi: bidi || oldBidi }
}

/** @param operations - Complete row properties. @returns Sorted explicitly unresolved source codes. */
export function unresolvedTableOperations(operations: readonly PropertyOperation[]): readonly number[] {
  return [...new Set(operations.map(operation => operation.opcode).filter(code => !admitted.has(code) && !tablePositionOpcodes.has(code)))].sort((a, b) => a - b)
}

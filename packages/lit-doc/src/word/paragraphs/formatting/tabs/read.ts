import { ByteView } from '../../../../binary/bytes'
import { requireDoc } from '../../../../errors'
import type { PropertyOperation } from '../../../properties/types'
import type { DocTabStop, TabOperation } from './types'

/** @param source - Bounded operand. @param offset - Relative word offset. @returns Signed sixteen-bit integer. */
function signed(source: ByteView, offset: number): number {
  const value = source.u16(offset)
  return value > 0x7fff ? value - 0x10000 : value
}

/**
 * Validates both tab operand variants before exposing ordered removals and additions.
 * @param operation - Original PChgTabs or PChgTabsPapx including its length prefix.
 * @returns Complete source edits with bounded, validated values.
 */
export function readTabOperation(operation: PropertyOperation): TabOperation {
  const { opcode, operand } = operation
  const source = new ByteView(operand, 'invalid-formatting-data')
  const extended = opcode === 0xc615
  const length = source.u8(0)
  requireDoc(length >= 2 && (extended && length === 255 || length + 1 === operand.length),
    'invalid-formatting-data', 'Invalid tab operand length')
  const removed = source.u8(1)
  requireDoc(removed <= 64, 'invalid-formatting-data', 'Too many removed tab stops')
  const addOffset = 2 + removed * (extended ? 4 : 2)
  const added = source.u8(addOffset)
  requireDoc(added <= 64 && addOffset + 1 + added * 3 === operand.length,
    'invalid-formatting-data', 'Tab counts disagree with the complete operand')
  const removals: TabOperation['removals'][number][] = []
  let prior = -Infinity
  for (let index = 0; index < removed; index++) {
    const position = signed(source, 2 + index * 2)
    requireDoc(position >= (extended ? -32768 : -31680) && position <= 31680 && position >= prior,
      'invalid-formatting-data', 'Invalid or unordered tab deletion position')
    const distance = extended ? signed(source, 2 + removed * 2 + index * 2) : 25
    requireDoc(distance >= -31680 && distance <= 31681, 'invalid-formatting-data', 'Invalid tab deletion radius')
    const radius = Math.max(25, distance)
    removals.push({ position, start: position - radius, end: position + radius })
    prior = position
  }
  const additions: DocTabStop[] = []
  prior = -Infinity
  for (let index = 0; index < added; index++) {
    const position = signed(source, addOffset + 1 + index * 2)
    const descriptor = source.u8(addOffset + 1 + added * 2 + index)
    const alignment = descriptor & 7
    const leader = alignment === 4 ? 0 : descriptor >>> 3 & 7
    requireDoc(position >= -31680 && position <= 31680 && position >= prior,
      'invalid-formatting-data', 'Invalid or unordered tab position')
    requireDoc([0, 1, 2, 3, 4, 6].includes(alignment) && [0, 1, 2, 3, 4, 5, 7].includes(leader),
      'invalid-formatting-data', 'Invalid tab alignment or leader')
    additions.push({ position, alignment: alignment as DocTabStop['alignment'], leader: leader as DocTabStop['leader'] })
    prior = position
  }
  return { removals, additions }
}

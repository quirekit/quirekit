import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { WordHeader } from '../types'
import type { DocCommentExtra } from './types'

/**
 * Reads a version-selected complete extension tree without evaluating dates.
 * @param table - Original selected source table.
 * @param header - Effective FIB version and source locators.
 * @param count - Already-budgeted reference count.
 * @param limits - Independent thread-depth ceiling.
 * @returns Parallel original extensions, or null entries when the extension is absent.
 */
export function readCommentExtras(table: Uint8Array, header: WordHeader, count: number, limits: DocReadLimits): (DocCommentExtra | null)[] {
  const range = header.version >= 0x101 ? header.records[112] : undefined
  if (!range?.length) return Array<null>(count).fill(null)
  requireDoc(range.length === count * 18, 'invalid-comment-data', 'Comment extension and reference counts disagree')
  const stream = new ByteView(table, 'invalid-comment-data')
  const data = new ByteView(stream.slice(range.offset, range.length), 'invalid-comment-data'), entries: DocCommentExtra[] = []
  // Parent deltas address records in either direction. All original records
  // must exist before depth consistency can validate forward parent links.
  for (let index = 0; index < count; index++) {
    const offset = index * 18, depth = data.u32(offset + 6), parentDelta = data.u32(offset + 10) | 0
    requireDoc(depth < limits.maxCommentDepth, 'limit-exceeded', 'Comment thread depth limit exceeded')
    const parentIndex = depth === 0 ? null : index + parentDelta
    requireDoc(parentIndex === null ? parentDelta === 0 : parentDelta !== 0 && parentIndex >= 0 && parentIndex < count,
      'invalid-comment-data', 'Invalid source comment parent')
    const rawFlags = data.u32(offset + 14)
    entries.push({ rawTimestamp: data.u32(offset), depth, parentDelta, parentIndex, rawFlags, ink: !!(rawFlags & 2) })
  }
  // A parent always has exactly one less depth. This rules out cycles without
  // an unbounded recursive graph walk or a source record-order assumption.
  for (const entry of entries) requireDoc(entry.parentIndex === null || entries[entry.parentIndex]!.depth + 1 === entry.depth,
    'invalid-comment-data', 'Invalid source comment thread depth')
  return entries
}

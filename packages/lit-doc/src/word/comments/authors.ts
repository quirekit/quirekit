import { ByteView } from '../../binary/bytes'
import { readUtf16Units } from '../../binary/strings'
import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { WordHeader } from '../types'

/**
 * Reads exact XST author strings without applying current-user defaults.
 * @param table - Selected source table stream.
 * @param header - Validated source locators.
 * @param limits - Validated independent author ceiling.
 * @returns Unique source author names in original order.
 */
export function readCommentAuthors(table: Uint8Array, header: WordHeader, limits: DocReadLimits): string[] {
  const range = header.records[36]!, stream = new ByteView(table, 'invalid-comment-data')
  const data = new ByteView(stream.slice(range.offset, range.length), 'invalid-comment-data')
  const authors: string[] = [], seen = new Set<string>()
  let offset = 0
  while (offset < data.bytes.length) {
    requireDoc(authors.length < limits.maxCommentAuthors, 'limit-exceeded', 'Comment author count limit exceeded')
    const size = data.u16(offset)
    requireDoc(size < 56, 'invalid-comment-data', 'Invalid source comment author length')
    const name = readUtf16Units(data, offset + 2, size)
    requireDoc(!seen.has(name), 'invalid-comment-data', 'Duplicate source comment author')
    authors.push(name)
    seen.add(name)
    offset += 2 + size * 2
  }
  return authors
}

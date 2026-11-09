import { ByteView } from '../../binary/bytes'
import { readUtf16Units } from '../../binary/strings'
import { requireDoc } from '../../errors'
import type { DocReadDiagnostic, DocReadLimits } from '../../types'
import type { WordHeader } from '../types'
import type { DocRevisionAuthorsSource } from './types'

/**
 * Reads exact original revision authors without interpreting their content references.
 * @param table - FIB-selected Table stream.
 * @param header - Validated source locators.
 * @param limits - Independent author-record and Unicode allocation ceilings.
 * @param diagnostics - Explicit compatibility decisions, with no author text in messages.
 * @returns Original table existence and source-ordered names.
 */
export function readRevisionAuthors(table: Uint8Array, header: WordHeader, limits: DocReadLimits,
  diagnostics: DocReadDiagnostic[]): DocRevisionAuthorsSource {
  const range = header.records[51]!
  if (!range.length) return { scope: 'revision-author-source', present: false, authors: [] }
  const source = new ByteView(table, 'invalid-revision-data')
  const data = new ByteView(source.slice(range.offset, range.length), 'invalid-revision-data')
  // Some saved files advertise only a zero-filled empty directory. Exact
  // emptiness is harmless; one nonzero byte must still pass the real STTB parser.
  if (data.bytes.length >= 6 && data.bytes.every(value => value === 0)) {
    diagnostics.push({ code: 'revision-author-empty-directory',
      message: 'The advertised revision-author directory is entirely zero-filled; it is retained as a present empty table without inventing an author.' })
    return { scope: 'revision-author-source', present: true, authors: [] }
  }
  requireDoc(data.u16(0) === 0xffff && data.u16(4) === 0, 'invalid-revision-data', 'Invalid extended revision-author table header')
  const count = data.u16(2)
  requireDoc(count < 0xffff, 'invalid-revision-data', 'Invalid two-byte revision-author count')
  requireDoc(count <= limits.maxRevisionAuthors, 'limit-exceeded', 'Revision author count limit exceeded')
  const authors: string[] = []
  let offset = 6, units = 0
  // Source slots are identity-bearing indexes. Neither duplicate names nor an
  // empty display value can be removed without changing later revision authors.
  for (let index = 0; index < count; index++) {
    const size = data.u16(offset)
    units += size
    requireDoc(units <= limits.maxRevisionAuthorCodeUnits, 'limit-exceeded', 'Revision author Unicode limit exceeded')
    authors.push(readUtf16Units(data, offset + 2, size))
    offset += 2 + size * 2
  }
  requireDoc(offset === data.bytes.length, 'invalid-revision-data', 'Unexpected trailing revision-author data')
  if (authors[0] !== 'Unknown') diagnostics.push({ code: 'revision-unknown-author-name-variant',
    message: 'The revision-author table has no standard Unknown first slot; exact source names and indexes are retained without synthesizing an author.' })
  return { scope: 'revision-author-source', present: true, authors }
}

import { ByteView } from '../../binary/bytes'
import { readUtf16Units } from '../../binary/strings'
import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { WordHeader, WordTextStorage } from '../types'
import { readCommentAuthors } from './authors'
import { readCommentBookmarks } from './bookmarks'
import { readCommentExtras } from './extra'
import type { DocCommentEntry, DocCommentsSource } from './types'

/**
 * Reads complete source comment membership independently of formatting and host models.
 * @param table - Selected table stream.
 * @param header - Validated source intervals and version-selected locators.
 * @param storage - Immutable concatenated original UTF-16 storage.
 * @param limits - Source reference, author and thread budgets.
 * @returns Exact original author, anchor, body and optional thread facts.
 */
export function readCommentRecords(table: Uint8Array, header: WordHeader, storage: WordTextStorage, limits: DocReadLimits): DocCommentsSource {
  const referenceRange = header.records[4]!, textRange = header.records[5]!, story = header.stories[3]!
  const count = referenceRange.length ? (referenceRange.length - 4) / 34 : 0
  requireDoc(Number.isInteger(count) && count >= 0, 'invalid-comment-data', 'Invalid comment reference PLC length')
  requireDoc(count <= limits.maxComments, 'limit-exceeded', 'Comment count limit exceeded')
  const length = story.end - story.start
  if (!length) {
    requireDoc(count === 0 && textRange.length === 0, 'invalid-comment-data', 'Empty comment story has active references or body indexes')
    return { scope: 'comment-source', authors: [], bookmarks: [], entries: [] }
  }
  requireDoc(textRange.length === (count + 2) * 4, 'invalid-comment-data', 'Comment reference and body counts disagree')
  const stream = new ByteView(table, 'invalid-comment-data')
  const content = new ByteView(stream.slice(textRange.offset, textRange.length), 'invalid-comment-data')
  requireDoc(content.u32(0) === 0 && content.u32(count * 4) === length - 1 && storage.text.charCodeAt(story.end - 1) === 13,
    'invalid-comment-data', 'Comment directory does not cover its full story')
  if (!count) return { scope: 'comment-source', authors: [], bookmarks: [], entries: [] }
  const authors = readCommentAuthors(table, header, limits), bookmarks = readCommentBookmarks(table, header, limits)
  const byTag = new Map(bookmarks.map(bookmark => [bookmark.tag, bookmark])), extras = readCommentExtras(table, header, count, limits)
  const references = new ByteView(stream.slice(referenceRange.offset, referenceRange.length), 'invalid-comment-data')
  const entries: DocCommentEntry[] = []
  let previousAnchor = -1, localStart = 0
  // Body CPs own complete messages and their paragraph endings. Their final
  // undefined sentinel cannot extend a body or consume the aggregate guard.
  for (let index = 0; index < count; index++) {
    const anchor = references.u32(index * 4), descriptor = (count + 1) * 4 + index * 30
    requireDoc(anchor > previousAnchor && anchor < header.stories[0]!.end && storage.text.charCodeAt(anchor) === 5,
      'invalid-comment-data', 'Invalid, duplicate or unordered source comment reference')
    const initialsSize = references.u16(descriptor), authorIndex = references.u16(descriptor + 20)
    requireDoc(initialsSize <= 9 && authorIndex < authors.length, 'invalid-comment-data', 'Invalid comment initials or author index')
    const bookmarkTag = references.u32(descriptor + 26), range = bookmarkTag === 0xffffffff ? null : byTag.get(bookmarkTag)
    requireDoc(range !== undefined && (!range || range.start < range.end), 'invalid-comment-data', 'Comment annotation tag has no nonempty source range')
    const localEnd = content.u32((index + 1) * 4)
    requireDoc(localEnd > localStart && localEnd < length && storage.text.charCodeAt(story.start + localEnd - 1) === 13,
      'invalid-comment-data', 'Invalid comment body range or missing paragraph ending')
    entries.push({ index, anchor, start: story.start + localStart, end: story.start + localEnd,
      authorIndex, author: authors[authorIndex]!, initials: readUtf16Units(references, descriptor + 2, initialsSize),
      bookmarkTag, range, extra: extras[index]! })
    previousAnchor = anchor
    localStart = localEnd
  }
  return { scope: 'comment-source', authors, bookmarks, entries }
}

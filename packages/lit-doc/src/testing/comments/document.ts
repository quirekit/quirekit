import { wordStreams } from '../word'
import type { CommentFixture, CommentFixtureOptions } from './types'

/**
 * Writes a source string as exact little-endian code units.
 * @param data - Independently allocated fixture bytes.
 * @param offset - First source code unit.
 * @param value - Original author or initials string.
 */
function utf16(data: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index++) data.setUint16(offset + index * 2, value.charCodeAt(index), true)
}

/**
 * Authors complete source comment tables independently of candidate readers.
 * @param main - Complete main-story text.
 * @param comments - Explicit references, source author slots and message bodies.
 * @param options - Independent metadata and malformed vectors.
 * @returns Root streams for the actual public reader.
 */
export function commentStreams(main: string, comments: readonly CommentFixture[], options: CommentFixtureOptions = {}): Record<string, Uint8Array> {
  const body = comments.length ? comments.map(comment => comment.text).join('') + '\r' : ''
  const text = main + body + (body ? '\r' : '')
  const streams = wordStreams([{ units: Array.from({ length: text.length }, (_, cp) => text.charCodeAt(cp)), unicode: true }],
    { version: options.version ?? 0x101, storyLengths: [main.length, 0, 0, body.length, 0, 0, 0] })
  const parts = new Map<number, Uint8Array>()
  const references = new Uint8Array(4 + comments.length * 34), refs = new DataView(references.buffer)
  const content = new Uint8Array((comments.length + 2) * 4), positions = new DataView(content.buffer)
  let cp = 0
  comments.forEach((comment, index) => {
    refs.setUint32(index * 4, comment.anchor, true)
    const descriptor = (comments.length + 1) * 4 + index * 30, initials = comment.initials ?? ''
    refs.setUint16(descriptor, initials.length, true)
    utf16(refs, descriptor + 2, initials.slice(0, 9))
    refs.setUint16(descriptor + 20, comment.authorIndex ?? 0, true)
    refs.setUint32(descriptor + 26, comment.bookmarkTag ?? 0xffffffff, true)
    positions.setUint32(index * 4, cp, true)
    cp += comment.text.length
  })
  refs.setUint32(comments.length * 4, 0xffffffff, true)
  positions.setUint32(comments.length * 4, cp, true)
  positions.setUint32((comments.length + 1) * 4, 0xffffffff, true)
  parts.set(4, references)
  if (comments.length) parts.set(5, content)
  const authors = options.authors ?? ['Author']
  const names = new Uint8Array(authors.reduce((size, name) => size + 2 + name.length * 2, 0)), namesView = new DataView(names.buffer)
  let offset = 0
  for (const name of authors) {
    namesView.setUint16(offset, name.length, true)
    utf16(namesView, offset + 2, name)
    offset += 2 + name.length * 2
  }
  if (names.length) parts.set(36, names)
  if (options.bookmarks) {
    const count = options.bookmarks.length, tags = new Uint8Array(6 + count * 12), tagView = new DataView(tags.buffer)
    tagView.setUint16(0, 0xffff, true); tagView.setUint16(2, count, true); tagView.setUint16(4, 10, true)
    const first = new Uint8Array(4 + count * 8), starts = new DataView(first.buffer)
    const ends = options.ends ?? [], last = new Uint8Array(4 + ends.length * 4), endsView = new DataView(last.buffer)
    options.bookmarks.forEach((bookmark, index) => {
      tagView.setUint16(8 + index * 12, 0x0100, true)
      tagView.setUint32(10 + index * 12, bookmark.tag, true)
      tagView.setUint32(14 + index * 12, 0xffffffff, true)
      starts.setUint32(index * 4, bookmark.start, true)
      starts.setUint16((count + 1) * 4 + index * 4, bookmark.endIndex, true)
      starts.setUint16((count + 1) * 4 + index * 4 + 2, bookmark.rawFlags ?? 0x4000, true)
    })
    starts.setUint32(count * 4, 0xffffffff, true)
    ends.forEach((end, index) => endsView.setUint32(index * 4, end, true))
    endsView.setUint32(ends.length * 4, 0xffffffff, true)
    parts.set(37, tags); parts.set(42, first); parts.set(43, last)
  }
  if (options.extras) {
    const extra = new Uint8Array(options.extras.length * 18), data = new DataView(extra.buffer)
    options.extras.forEach((record, index) => {
      data.setUint32(index * 18, record.timestamp ?? 0, true)
      data.setUint32(index * 18 + 6, record.depth ?? 0, true)
      data.setInt32(index * 18 + 10, record.parentDelta ?? 0, true)
      data.setUint32(index * 18 + 14, record.flags ?? 0, true)
    })
    parts.set(112, extra)
  }
  const original = streams['1Table']!, table = new Uint8Array(original.length + [...parts.values()].reduce((size, bytes) => size + bytes.length, 0))
  table.set(original)
  const fib = new DataView(streams.WordDocument!.buffer)
  offset = original.length
  for (const [field, bytes] of parts) {
    if (field < fib.getUint16(152, true)) {
      fib.setUint32(154 + field * 8, offset, true)
      fib.setUint32(158 + field * 8, bytes.length, true)
    }
    table.set(bytes, offset)
    offset += bytes.length
  }
  return { ...streams, '1Table': table }
}

import { ByteView } from '../../binary/bytes'
import { readUtf16Units } from '../../binary/strings'
import { requireDoc } from '../../errors'
import type { WordFontRecord } from './types'

const charsets = new Set([0, 1, 2, 77, 128, 129, 130, 134, 136, 161, 162, 163, 177, 178, 186, 204, 222, 238, 255])

/**
 * Reads the complete non-extended font STTB, retaining names and substitution metadata.
 * @param bytes - Exact SttbfFfn extent from the selected Table stream.
 * @returns Font records in original index order, without consulting installed fonts.
 */
export function readFontRecords(bytes: Uint8Array): readonly WordFontRecord[] {
  const source = new ByteView(bytes, 'invalid-formatting-data')
  const count = source.u16(0)
  requireDoc(count <= 0x7ff0 && source.u16(2) === 0, 'invalid-formatting-data', 'Invalid source font-table header')
  const result: WordFontRecord[] = []
  let position = 4
  for (let i = 0; i < count; i++) {
    const size = source.u8(position++)
    const record = source.slice(position, size)
    result.push(readFont(record)); position += size
  }
  requireDoc(position === bytes.length, 'invalid-formatting-data', 'Font table contains unexplained trailing data')
  return result
}

/**
 * Validates one source descriptor before decoding either of its names.
 * @param bytes - Exactly one FFN, excluding its STTB length prefix.
 * @returns Independently owned font metadata.
 */
function readFont(bytes: Uint8Array): WordFontRecord {
  requireDoc(bytes.length >= 41 && (bytes.length - 39) % 2 === 0,
    'invalid-formatting-data', 'Font record has an invalid descriptor/name envelope')
  const source = new ByteView(bytes, 'invalid-formatting-data')
  const flags = source.u8(0)
  const pitch = flags & 3
  const family = flags >>> 4 & 7
  const weight = source.u16(1)
  const charset = source.u8(3)
  requireDoc(pitch <= 2 && family <= 5 && weight <= 1000 && charsets.has(charset),
    'invalid-formatting-data', 'Invalid source font substitution descriptor')
  const length = (bytes.length - 39) / 2
  const firstEnd = nameEnd(source, 0, length)
  const alternate = source.u8(4)
  const name = readUtf16Units(source, 39, firstEnd)
  let alternateName: string | undefined
  let finalEnd = firstEnd
  if (alternate) {
    requireDoc(alternate === firstEnd + 1, 'invalid-formatting-data', 'Font alias does not follow its primary name')
    const end = nameEnd(source, alternate, length)
    alternateName = readUtf16Units(source, 39 + alternate * 2, end - alternate)
    finalEnd = end
  }
  // Some producers retain spare zero capacity inside the declared FFN extent.
  // Accept only empty capacity after complete names, never an undeclared string.
  for (let cursor = finalEnd + 1; cursor < length; cursor++) requireDoc(source.u16(39 + cursor * 2) === 0,
    'invalid-formatting-data', 'Font name padding contains nonzero data')
  const namePadding = length - finalEnd - 1
  return { name, ...(alternateName === undefined ? {} : { alternateName }), ...(namePadding ? { namePadding } : {}), pitch: pitch as 0 | 1 | 2, family,
    trueType: (flags & 4) !== 0, weight, charset, panose: Array.from(source.slice(5, 10)),
    signature: Array.from({ length: 6 }, (_, i) => source.u32(15 + i * 4)) }
}

/**
 * Finds a nonempty terminated name inside the bounded FFN name area.
 * @param source - Whole descriptor.
 * @param start - First name code-unit index relative to the name area.
 * @param length - Total available name code units.
 * @returns Index of the terminating zero, without consuming a following alias.
 */
function nameEnd(source: ByteView, start: number, length: number): number {
  let cursor = start
  while (cursor < length && source.u16(39 + cursor * 2) !== 0) cursor++
  requireDoc(cursor > start && cursor < length, 'invalid-formatting-data', 'Font name is empty or unterminated')
  return cursor
}

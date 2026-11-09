import { ByteView } from '../binary/bytes'
import { requireDoc } from '../errors'
import type { DocReadLimits } from '../types'
import { decodeTextSpan } from './encoding'
import type { TextPieceRecord, WordHeader, WordTextStorage } from './types'

/**
 * Resolves CLX text pieces while keeping property records available to later readers.
 * @param wordBytes - WordDocument stream.
 * @param tableBytes - FIB-selected Table stream.
 * @param header - Validated source counts and locators.
 * @param limits - Per-call allocation ceilings.
 * @param recover - Whether a damaged map may retain its first independently readable main-story range.
 * @returns Exact text and internal piece/property records.
 */
export function readTextStorage(wordBytes: Uint8Array, tableBytes: Uint8Array,
  header: WordHeader, limits: DocReadLimits, recover = false): WordTextStorage {
  const range = header.records[33]!
  requireDoc(range.length > 0, 'invalid-text-map', 'DOC has no CLX piece table')
  const table = new ByteView(tableBytes, 'invalid-text-map')
  const available = recover ? Math.min(range.length, Math.max(0, tableBytes.length - range.offset)) : range.length
  const clx = new ByteView(table.slice(range.offset, available), 'invalid-text-map')
  const word = new ByteView(recover ? wordBytes : wordBytes.subarray(0, header.meaningfulBytes), 'invalid-text-map')
  const propertyGroups: Uint8Array[] = []
  let position = 0
  while (clx.u8(position) === 1) {
    requireDoc(propertyGroups.length < 32768, 'limit-exceeded', 'CLX property-group limit exceeded')
    const length = clx.u16(position + 1)
    requireDoc(length <= 0x3fa2, 'invalid-text-map', 'Invalid CLX property-group length')
    propertyGroups.push(clx.slice(position + 3, length))
    position += 3 + length
  }
  requireDoc(clx.u8(position) === 2, 'invalid-text-map', 'CLX does not end in a text piece table')
  const length = clx.u32(position + 1)
  requireDoc(length >= 4 && (length - 4) % 12 === 0 && (recover ? position + 5 + length <= clx.bytes.length : position + 5 + length === clx.bytes.length),
    'invalid-text-map', 'Invalid text piece table size')
  const count = (length - 4) / 12
  requireDoc(count <= limits.maxPieces, 'limit-exceeded', 'Text piece limit exceeded')
  const plc = new ByteView(clx.slice(position + 5, length), 'invalid-text-map')
  const endpointsValid = plc.u32(0) === 0 && plc.u32(count * 4) === header.textLength
  requireDoc(recover || endpointsValid,
    'invalid-text-map', 'Text piece endpoints disagree with subdocument counts')
  const pieces: TextPieceRecord[] = []
  const parts: string[] = []
  let damaged = !endpointsValid || available !== range.length
  let retainedStart = plc.u32(0), retainedEnd = retainedStart

  // Traverse logical CP ranges; physical FC addresses may move backwards after fast saves.
  for (let index = 0; index < count; index++) {
    const start = plc.u32(index * 4)
    let end = plc.u32((index + 1) * 4)
    if (recover && start === end) { damaged = true; continue }
    if (recover && end < start) { damaged = true; break }
    requireDoc(start < end && (recover || end <= header.textLength), 'invalid-text-map', 'Text positions are not strictly increasing')
    const descriptor = (count + 1) * 4 + index * 8
    const encoded = plc.u32(descriptor + 2)
    const unicode = (encoded & 0x40000000) === 0
    const address = encoded & 0x3fffffff
    requireDoc(unicode || address % 2 === 0, 'invalid-text-map', 'Compressed text has an odd encoded byte position')
    const byteOffset = unicode ? address : address / 2
    if (recover && end > header.textLength) { damaged = true; end = header.textLength }
    if (recover && end <= start) break
    requireDoc(end <= limits.maxTextCodeUnits, 'limit-exceeded', 'Text code-unit limit exceeded')
    if (recover) {
      const readableEnd = start + Math.floor(Math.max(0, word.bytes.length - byteOffset) / (unicode ? 2 : 1))
      const clipped = Math.min(end, readableEnd)
      if (clipped < end) { damaged = true; end = clipped }
      if (end <= start) break
    }
    const byteLength = (end - start) * (unicode ? 2 : 1)
    if (recover && byteOffset + byteLength > header.meaningfulBytes) {
      header.meaningfulBytes = wordBytes.length
      header.diagnostics = [...header.diagnostics, { code: 'fib-length-hint-ignored',
        message: 'A validated text span exceeds cbMac. Actual WordDocument bytes bound source reads.' }]
    }
    requireDoc(byteOffset >= header.headerLength, 'invalid-text-map', 'Text overlaps the file information block')
    const propertyModifier = plc.u16(descriptor + 6)
    const propertyValid = (propertyModifier & 1) === 0 || (propertyModifier >>> 1) < propertyGroups.length
    requireDoc(recover || propertyValid,
      'invalid-text-map', 'Text property reference has no CLX group')
    if (!propertyValid) damaged = true
    const piece = { start, end, byteOffset, byteLength, unicode, flags: plc.u16(descriptor), propertyModifier }
    parts.push(decodeTextSpan(word.slice(byteOffset, byteLength), unicode))
    pieces.push(piece)
    retainedEnd = end
    if (end !== plc.u32((index + 1) * 4)) break
  }
  if (!damaged) return { text: parts.join(''), pieces, propertyGroups }

  // A damaged map retains its original CP interval. Only the ordinary-text
  // projector consumes it, so missing CPs cannot acquire formatting or objects.
  const main = header.stories[0]!
  retainedStart = Math.max(retainedStart, main.start)
  retainedEnd = Math.min(retainedEnd, main.end)
  requireDoc(retainedEnd > retainedStart, 'invalid-text-map', 'No independently readable main-story text range remains')
  const text = parts.join('').slice(retainedStart - plc.u32(0), retainedEnd - plc.u32(0))
  requireDoc(retainedStart === 0 || !header.records[16]!.length && !/[\u0013-\u0015]/u.test(text),
    'invalid-text-map', 'Missing main-story prefix prevents establishing field visibility')
  header.diagnostics = [...header.diagnostics, { code: 'text-map-range-recovered',
    message: `Only the actual continuous main-story CP interval [${retainedStart}, ${retainedEnd}) is recovered from the damaged text map.` }]
  return { text, pieces, propertyGroups, recoveredRange: { kind: 'main', start: retainedStart, end: retainedEnd } }
}

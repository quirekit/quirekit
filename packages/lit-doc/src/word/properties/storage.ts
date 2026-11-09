import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { WordHeader } from '../types'
import { findByteInterval } from './search'
import type { FormattingIndexOptions, PhysicalPropertyIndex, PhysicalPropertyMatch, PhysicalPropertyRecord } from './types'

/**
 * Reads one FC-to-page index with bounded lazy page parsing and explicit BTE authority.
 * @param word - WordDocument stream.
 * @param table - Selected Table stream.
 * @param header - Validated FIB and stream extent.
 * @param limits - Page allocation ceilings.
 * @param options - Typed family locator and page parser.
 * @returns Lookup preserving both source-record and page-selection extents.
 */
export function readFormattingIndex<Record extends PhysicalPropertyRecord>(word: Uint8Array, table: Uint8Array,
  header: WordHeader, limits: DocReadLimits, options: FormattingIndexOptions<Record>): PhysicalPropertyIndex<Record> {
  const { label, code } = options
  const range = header.records[options.field]!
  requireDoc(range.length >= 12 && (range.length - 4) % 8 === 0, code, `Missing or invalid ${label.toLowerCase()} formatting index`)
  const count = (range.length - 4) / 8
  requireDoc(count <= limits.maxFormattingPages, 'limit-exceeded', `${label} formatting page limit exceeded`)
  const index = new ByteView(new ByteView(table, code).slice(range.offset, range.length), code)
  const source = new ByteView(word.subarray(0, header.meaningfulBytes), code)
  const boundaries = Array.from({ length: count + 1 }, (_, i) => index.u32(i * 4))
  for (let i = 0; i < count; i++) requireDoc(boundaries[i]! < boundaries[i + 1]!, code, `${label} index FC boundaries must strictly increase`)
  const pages = new Map<number, readonly Record[]>()

  /** @param entry - Validated physical index slot. @returns Complete immutable page records shared by lookup and endpoint checks. */
  function page(entry: number): readonly Record[] {
    const offset = (index.u32((count + 1) * 4 + entry * 4) & 0x3fffff) * 512
    let records = pages.get(offset)
    if (!records) {
      requireDoc(offset >= header.headerLength, code, `${label} page overlaps FIB`)
      records = options.readPage(source.slice(offset, 512)); pages.set(offset, records)
    }
    return records
  }

  /**
   * Uses BTE first, then a source page; cached records never bypass BTE coverage.
   * @param byteOffset - Complete marker or text character FC.
   * @param width - Encoded character width.
   * @param allowMissing - Whether a wholly absent covering interval is an explicit result.
   * @returns Original record and selected BTE endpoint, or permitted absence.
   */
  function lookup(byteOffset: number, width: number, allowMissing: boolean): PhysicalPropertyMatch<Record> | undefined {
    source.check(byteOffset, width)
    const entry = findByteInterval(boundaries, byteOffset)
    if (entry < 0 && allowMissing) {
      requireDoc(byteOffset + width <= boundaries[0]! || byteOffset >= boundaries[count]!,
        code, `${label} character partially overlaps formatting-index coverage`)
      return undefined
    }
    requireDoc(entry >= 0 && byteOffset + width <= boundaries[entry + 1]!, code, `${label} ending has no complete formatting-index coverage`)
    const records = page(entry)
    const cuts = records.map(record => record.byteStart)
    cuts.push(records[records.length - 1]!.byteEnd)
    const selected = findByteInterval(cuts, byteOffset)
    if (selected < 0 && allowMissing) {
      requireDoc(byteOffset + width <= cuts[0]! || byteOffset >= cuts[cuts.length - 1]!,
        code, `${label} character partially overlaps formatting-page coverage`)
      return undefined
    }
    requireDoc(selected >= 0 && byteOffset + width <= records[selected]!.byteEnd, code, `${label} ending has no complete formatting-page coverage`)
    return { record: records[selected]!, rangeEnd: boundaries[entry + 1]! }
  }
  return {
    /** @param byteOffset - Complete source character FC. @param width - Encoded character width. @returns Required original source record and BTE extent. */
    locate(byteOffset, width) { return lookup(byteOffset, width, false)! },
    /** @param byteOffset - Complete source character FC. @param width - Encoded character width. @returns Actual coverage or explicit absence, preserving malformed-source errors. */
    find(byteOffset, width) { return lookup(byteOffset, width, true) },
    /** @param byteOffset - Exact proposed end of both original authorities. @returns Whether the index and validated page agree without extending coverage. */
    endsAt(byteOffset) {
      if (byteOffset !== boundaries[count]) return false
      const records = page(count - 1)
      return records[records.length - 1]!.byteEnd === byteOffset
    },
  }
}

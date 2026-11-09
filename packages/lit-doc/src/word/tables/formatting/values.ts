import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { SourceTableWidth } from './types'

/** @param raw - Unsigned stored word. @returns Signed twips within the source distance range. */
export function tableDistance(raw: number): number {
  const value = raw >= 0x8000 ? raw - 0x10000 : raw
  requireDoc(Math.abs(value) <= 31680, 'invalid-table-data', 'Table distance is outside its valid range')
  return value
}

/** @param value - Stored Bool8. @returns Exact Boolean, retaining explicit false. */
export function tableBoolean(value: number): boolean {
  requireDoc(value <= 1, 'invalid-table-data', 'Invalid table Boolean operand')
  return value === 1
}

/**
 * Keeps preferred units independent of physical geometry.
 * @param type - Source Fts code.
 * @param raw - Unsigned stored measurement.
 * @param signed - Whether a leading indent can be negative.
 * @returns Validated preferred dimension.
 */
export function tableWidth(type: number, raw: number, signed = false): SourceTableWidth {
  requireDoc(type <= 3, 'unsupported-table', `Table width unit ${type} has no admitted mapping`)
  const value = signed ? tableDistance(raw) : raw
  requireDoc(signed || raw <= 0x7fff, 'invalid-table-data', 'Negative preferred table or cell width')
  requireDoc(type !== 2 || value >= 0 && value <= 30000, 'invalid-table-data', 'Preferred percentage exceeds the source interval')
  requireDoc(type !== 3 || Math.abs(value) <= 31680, 'invalid-table-data', 'Preferred table width exceeds the source distance interval')
  return { type: ['nil', 'auto', 'pct', 'dxa'][type] as SourceTableWidth['type'], value: type <= 1 ? 0 : value }
}

/**
 * Validates a source half-open range before touching any cell.
 * @param source - Independently bounded operand.
 * @param offset - Position of ItcFirstLim after any length prefix.
 * @param count - Currently established source cell count.
 * @returns Exact first/limit pair, including an admitted empty range.
 */
export function tableCellRange(source: ByteView, offset: number, count: number): [number, number] {
  const first = source.u8(offset), end = source.u8(offset + 1)
  requireDoc(first < count && first <= end && end <= count, 'invalid-table-data', 'Table property refers outside the current cell definitions')
  return [first, end]
}

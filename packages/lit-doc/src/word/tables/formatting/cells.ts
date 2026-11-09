import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { PropertyOperation, PropertyReader } from '../../properties/types'
import type { SourceCellFormat, SourceRowFormat } from './types'
import { tableBoolean, tableCellRange, tableWidth } from './values'

const directions = new Map([[0, 'lrTb'], [1, 'tbRl'], [3, 'btLr'], [4, 'lrTbV'], [5, 'tbRlV']])

/** @param code - Source TextFlow. @returns Exact standard spelling without a fallback rotation. */
function direction(code: number): string {
  const value = directions.get(code)
  requireDoc(value, 'invalid-table-data', 'Invalid table cell text flow')
  return value
}

/** @param code - Source VerticalMergeFlag. @returns Exact vertical role. */
function vertical(code: number): SourceCellFormat['vertical'] {
  requireDoc(code === 0 || code === 1 || code === 3, 'invalid-table-data', 'Invalid source vertical merge role')
  return code === 0 ? 'none' : code === 1 ? 'continue' : 'restart'
}

/** @param code - Source VerticalAlign. @returns Exact alignment. */
function alignment(code: number): SourceCellFormat['verticalAlign'] {
  requireDoc(code <= 2, 'invalid-table-data', 'Invalid table cell vertical alignment')
  return ['top', 'center', 'bottom'][code] as SourceCellFormat['verticalAlign']
}

/**
 * Creates an inserted cell without inventing source style contributions.
 * @returns Fresh canonical cell defaults with an empty direct-field set.
 */
export function defaultSourceCell(): SourceCellFormat {
  return { horizontal: 'none', vertical: 'none', width: null, textDirection: 'lrTb', verticalAlign: 'top',
    fitText: false, noWrap: false, hideMark: false, fields: new Set(), unprojectedBorders: false }
}

/**
 * Decodes TCGRF as enumerations rather than historical Boolean accessor names.
 * @param bytes - Optional source TC80; omission explicitly uses its normative default tuple.
 * @returns Independent cell values and their source ownership.
 */
export function readInitialCell(bytes?: Uint8Array): SourceCellFormat {
  const source = new ByteView(bytes ?? new Uint8Array(20), 'invalid-table-data')
  const flags = source.u16(0)
  return { horizontal: (flags & 3) === 0 ? 'none' : (flags & 3) === 1 ? 'continue' : 'restart',
    vertical: vertical(flags >>> 5 & 3), width: tableWidth(flags >>> 9 & 7, source.u16(2)),
    textDirection: direction(flags >>> 2 & 7), verticalAlign: alignment(flags >>> 7 & 3),
    fitText: !!(flags & 0x1000), noWrap: !!(flags & 0x2000), hideMark: !!(flags & 0x4000),
    fields: new Set(['width', 'textDirection', 'verticalAlign', 'fitText', 'noWrap', 'hideMark']),
    unprojectedBorders: source.slice(4, 16).some(value => value !== 0) }
}

/**
 * Applies one admitted range operation to the same source cells used for topology.
 * @param operation - Exact bounded operation.
 * @param row - Private row candidate.
 * @param reader - Shared source work budget.
 * @returns Whether the operation belongs to this cell family.
 */
export function applyCellFormat(operation: PropertyOperation, row: SourceRowFormat, reader: PropertyReader): boolean {
  const { opcode, operand } = operation
  const source = new ByteView(operand, 'invalid-table-data')
  if (opcode === 0xd62b) {
    requireDoc(source.u8(0) === 2 && source.u8(1) < row.cells.length, 'invalid-table-data', 'Invalid vertical merge operand')
    row.cells[source.u8(1)]!.vertical = vertical(source.u8(2))
    return true
  }
  if (![0x5624, 0x5625, 0x7629, 0xd62c, 0xd635, 0xf636, 0xd639, 0xd642].includes(opcode)) return false
  const offset = opcode >>> 13 === 6 ? 1 : 0
  const [first, end] = tableCellRange(source, offset, row.cells.length)
  reader.consume(end - first)
  for (let index = first; index < end; index++) {
    const cell = row.cells[index]!
    if (opcode === 0x5624) cell.horizontal = index === first ? 'restart' : 'continue'
    else if (opcode === 0x5625) cell.horizontal = 'none'
    else if (opcode === 0x7629) { cell.textDirection = direction(source.u16(2)); cell.fields.add('textDirection') }
    else if (opcode === 0xd62c) { cell.verticalAlign = alignment(source.u8(3)); cell.fields.add('verticalAlign') }
    else if (opcode === 0xd635) { cell.width = tableWidth(source.u8(3), source.u16(4)); cell.fields.add('width') }
    else if (opcode === 0xf636) { cell.fitText = tableBoolean(source.u8(2)); cell.fields.add('fitText') }
    else if (opcode === 0xd639) { cell.noWrap = tableBoolean(source.u8(3)); cell.fields.add('noWrap') }
    else { cell.hideMark = tableBoolean(source.u8(3)); cell.fields.add('hideMark') }
  }
  return true
}

import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { PropertyOperation, PropertyReader } from '../../properties/types'
import { readRowDefinitionChange } from '../definitions'
import { tablePositionOpcodes } from '../position'
import { applyCellFormat } from './cells'
import { applyRowDefinition } from './structure'
import type { SourceRowFormat } from './types'
import { tableBoolean, tableCellRange, tableDistance, tableWidth } from './values'
import { hasTablePropertyRevision } from '../revisions'

/**
 * Compiles direct row properties without XML or observable partial diagnostics.
 * @param operations - The original PAPX then piece order, captured by the topology owner.
 * @param reader - Common source parse/application budget.
 * @returns Complete direct row tuple, retaining explicit values and unresolved fields.
 */
export function readRowFormat(operations: readonly PropertyOperation[], reader: PropertyReader): SourceRowFormat {
  hasTablePropertyRevision(operations)
  const row: SourceRowFormat = { edges: [0], cells: [], table: { width: null, indent: null, alignment: 'start', layout: 'fixed' },
    height: null, cantSplit: null, header: null, before: null, after: null, left: null, gapHalf: 0, unsupportedOpcodes: [] }
  const modernSplit = operations.some(operation => operation.opcode === 0x3466)
  reader.consume(operations.length)
  for (const operation of operations) {
    const change = readRowDefinitionChange(operation, row.cells.length)
    if (change) { applyRowDefinition(change, row, reader); continue }
    const { opcode, operand } = operation
    if ((opcode >>> 10 & 7) !== 5) continue
    const source = new ByteView(operand, 'invalid-table-data')
    if (applyCellFormat(operation, row, reader)) continue
    if (opcode === 0x7623) {
      const [first, end] = tableCellRange(source, 0, row.cells.length)
      const width = tableDistance(source.u16(2))
      requireDoc(width >= 0, 'invalid-table-data', 'Negative physical column width')
      const edges = [...row.edges]
      let delta = 0
      // Resolve each original width before shifting the later boundary vector;
      // otherwise a range assignment would accidentally compound its own edits.
      for (let index = first; index < end; index++) {
        delta += width - (row.edges[index + 1]! - row.edges[index]!)
        edges[index + 1] = row.edges[index + 1]! + delta
      }
      for (let index = end + 1; index < edges.length; index++) edges[index] = row.edges[index]! + delta
      reader.consume(edges.length)
      row.edges = edges
    } else if (opcode === 0x9601) row.left = tableDistance(source.u16(0))
    else if (opcode === 0x9602) {
      row.gapHalf = tableDistance(source.u16(0))
      requireDoc(row.gapHalf >= 0, 'invalid-table-data', 'Negative source gap-half offset')
    } else if (opcode === 0x3403 || opcode === 0x3466) {
      const value = tableBoolean(source.u8(0))
      if (opcode === 0x3466 || !modernSplit) row.cantSplit = value
    } else if (opcode === 0x3404) row.header = tableBoolean(source.u8(0))
    else if (opcode === 0x9407) {
      const value = tableDistance(source.u16(0))
      row.height = { value: Math.abs(value), rule: value === 0 ? 'auto' : value < 0 ? 'exact' : 'atLeast' }
    } else if (opcode === 0xf614) row.table.width = tableWidth(source.u8(0), source.u16(1))
    else if (opcode === 0xf661) row.table.indent = tableWidth(source.u8(0), source.u16(1), true)
    else if (opcode === 0xf617) row.before = tableWidth(source.u8(0), source.u16(1))
    else if (opcode === 0xf618) row.after = tableWidth(source.u8(0), source.u16(1))
    else if (opcode === 0x3615) row.table.layout = tableBoolean(source.u8(0)) ? 'autofit' : 'fixed'
    else if (opcode === 0x5400 || opcode === 0x548a) {
      const value = source.u16(0)
      requireDoc(value <= 2, 'invalid-table-data', 'Invalid table justification')
      row.table.alignment = (opcode === 0x5400 ? ['left', 'center', 'right'] : ['start', 'center', 'end'])[value] as SourceRowFormat['table']['alignment']
    } else if (![0x560b, 0x5664, 0x7469, 0xd667, 0x3668].includes(opcode) && !tablePositionOpcodes.has(opcode)) row.unsupportedOpcodes.push(opcode)
  }
  if (row.left !== null) {
    const shift = row.left - row.gapHalf - row.edges[0]!
    row.edges = row.edges.map(value => value + shift)
  }
  row.unsupportedOpcodes = [...new Set(row.unsupportedOpcodes)].sort((left, right) => left - right)
  return row
}

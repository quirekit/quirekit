import { requireDoc } from '../../errors'
import { readRowFormat } from '../../word/tables/formatting'
import type { DocTable } from '../../word/tables/types'
import type { PropertyReader } from '../../word/properties/types'
import type { SourceRowFormat } from '../../word/tables/formatting'
import type { ConversionSource } from '../source/types'
import type { CompiledTableGeometry, CompiledTableRow } from './types'

/**
 * Unifies direct page coordinates while preserving every explicit source cell.
 * @param table - Already validated source membership.
 * @param source - Captured row authorities and common work budget.
 * @returns Complete common grid and adjacent merge graph.
 */
export function compileTableGeometry(table: DocTable, source: ConversionSource): CompiledTableGeometry {
  const rows = table.rows.map(row => {
    const operations = source.tableRowOperations.get(row.markerStart)
    if (!operations) throw new Error('Missing captured source table-row authority')
    const format = readRowFormat(operations, source.context.reader)
    requireDoc(format.cells.length === row.cells.length && format.edges.length === row.cells.length + 1,
      'invalid-table-data', 'Source formatting and table membership disagree')
    return format
  })
  return unifyTableGeometry(rows, source.context.reader)
}

/**
 * Resolves one common grid and validates merge ownership against adjacent rows.
 * @param rows - Complete direct row tuples in source order.
 * @param reader - Shared operation/allocation budget.
 * @returns Fully validated geometry before any XML or retention diagnostic.
 */
export function unifyTableGeometry(rows: readonly SourceRowFormat[], reader: PropertyReader): CompiledTableGeometry {
  requireDoc(rows.length > 0, 'invalid-table-data', 'Table geometry requires a nonempty row collection')
  reader.consume(rows.reduce((sum, row) => sum + row.edges.length, 0))
  for (const row of rows) {
    requireDoc(row.cells.length > 0 && row.edges.length === row.cells.length + 1, 'invalid-table-data', 'Invalid row geometry shape')
    requireDoc(row.edges.every((value, index) => Number.isSafeInteger(value) && Math.abs(value) <= 31680
      && (index === 0 || value > row.edges[index - 1]!)), 'unsupported-table', 'Zero-width or out-of-range table grid intervals require a dedicated projection')
    requireDoc(!row.table.indent || row.table.indent.type === 'nil' || row.table.indent.type === 'dxa',
      'unsupported-table', 'Preferred table indent has no admitted OOXML interpretation')
  }
  const coordinates = [...new Set(rows.flatMap(row => row.edges))].sort((left, right) => left - right)
  const indexes = new Map(coordinates.map((value, index) => [value, index]))
  const grid = coordinates.slice(1).map((value, index) => value - coordinates[index]!)
  let headerPrefix = true
  let previousVertical = new Set<string>()
  const compiled: CompiledTableRow[] = []

  // All rows use one immutable coordinate authority. Merge continuation is
  // valid only against the immediately preceding row with the exact grid span.
  for (const row of rows) {
    const spans = row.cells.map((_, index) => indexes.get(row.edges[index + 1]!)! - indexes.get(row.edges[index]!)!)
    let horizontal = false
    const vertical = new Set<string>()
    row.cells.forEach((cell, index) => {
      const key = `${indexes.get(row.edges[index]!)}:${spans[index]}`
      requireDoc(cell.horizontal !== 'continue' || horizontal, 'invalid-table-data', 'Horizontal continuation has no preceding source owner')
      horizontal = cell.horizontal !== 'none'
      if (cell.vertical === 'continue') requireDoc(previousVertical.has(key), 'invalid-table-data', 'Vertical continuation has no matching adjacent source owner')
      if (cell.vertical !== 'none') vertical.add(key)
    })
    previousVertical = vertical
    const header: boolean | null = row.header === null ? null : headerPrefix && row.header
    headerPrefix = header === true
    compiled.push({ source: row, spans, header, before: indexes.get(row.edges[0]!)!,
      after: grid.length - indexes.get(row.edges[row.edges.length - 1]!)! })
  }
  return { origin: coordinates[0]!, end: coordinates[coordinates.length - 1]!, grid, rows: compiled }
}

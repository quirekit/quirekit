import type { Node as PMNode } from '@quirekit/pm'
import { createWordTableMap } from '../map'

/**
 * Projects a preserved internal table into a static HTML shape with one td per semantic origin.
 * @param table - Copied physical table; its nodes and attributes remain unchanged.
 * @returns Display-only table with full native HTML row and column spans.
 */
export function projectWordTableHtml(table: PMNode): PMNode {
  const map = createWordTableMap(table)
  const explicitById = new Map(map.explicitCells.map(cell => [cell.id, cell] as const))
  const rows: PMNode[] = []
  // Persistent cells retain every source member. Static HTML instead needs one
  // td with the complete rectangle, including legacy horizontal merge groups.
  for (let rowIndex = 0; rowIndex < map.height; rowIndex++) {
    const sourceRow = table.child(rowIndex), cells: PMNode[] = []
    for (let column = 0; column < map.width; column++) {
      const semantic = map.cellAt(rowIndex, column)
      if (!semantic || semantic.rect.startRow !== rowIndex || semantic.rect.startColumn !== column) continue
      const explicit = explicitById.get(semantic.originExplicitCellId)
      if (!explicit) continue
      const origin = table.child(explicit.rowIndex).child(explicit.cellIndex)
      cells.push(origin.type.create({ ...origin.attrs,
        colspan: semantic.rect.columnSpan, gridSpan: semantic.rect.columnSpan,
        rowspan: semantic.rect.rowSpan, hMerge: null, vMerge: null
      }, origin.content, origin.marks))
    }
    rows.push(sourceRow.type.create(sourceRow.attrs, cells, sourceRow.marks))
  }
  return table.type.create(table.attrs, rows, table.marks)
}

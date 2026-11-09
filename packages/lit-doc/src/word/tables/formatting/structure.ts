import type { PropertyReader } from '../../properties/types'
import type { RowDefinitionChange } from '../definitions'
import { defaultSourceCell, readInitialCell } from './cells'
import type { SourceRowFormat } from './types'

/**
 * Applies a shared decoded mutation without reinterpreting its opcode or ranges.
 * @param change - Already validated structural mutation.
 * @param row - Private direct-row state.
 * @param reader - Shared work budget, including bounded per-cell work.
 */
export function applyRowDefinition(change: RowDefinitionChange, row: SourceRowFormat, reader: PropertyReader): void {
  reader.consume(change.count * 8 + 1)
  if (change.kind === 'initial') {
    row.edges = [...change.edges]
    row.cells = Array.from({ length: change.count }, (_, index) => readInitialCell(change.cells[index]))
  } else if (change.kind === 'insert') {
    const origin = row.edges[change.at]!
    const added = change.inserted * change.width
    row.edges = [...row.edges.slice(0, change.at), ...Array.from({ length: change.inserted }, (_, index) => origin + index * change.width),
      ...row.edges.slice(change.at).map(value => value + added)]
    row.cells.splice(change.at, 0, ...Array.from({ length: change.inserted }, defaultSourceCell))
  } else {
    // Definition deletion removes the corresponding boundary entries. Surviving
    // page coordinates remain authoritative rather than collapsing the gap.
    row.edges.splice(change.first, change.end - change.first)
    row.cells.splice(change.first, change.end - change.first)
  }
}

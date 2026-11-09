import { DocReadError, requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import { readFieldIndex } from '../../word/fields/read'
import type { DocTableCell } from '../../word/tables/types'
import type { ConversionSource } from '../source/types'
import type { ConversionFieldIndex, ConversionFieldState } from './types'

/** @param limits - Validated source ceilings. @returns Caches and independent source/traversal counters for one conversion. */
export function createFieldState(limits: DocReadLimits): ConversionFieldState {
  return { indexes: new Map(), indexed: { remaining: limits.maxFields }, projected: { remaining: limits.maxFields }, cells: new WeakMap() }
}

/**
 * Loads a complete document-part index once; actual header/note scopes remain independent.
 * @param source - Canonical source sharing document caches and allocation ownership.
 * @param start - Actual Story's first source position.
 * @param end - Actual Story's exclusive source endpoint.
 * @returns Cached index and exact token-identity maps.
 */
export function conversionFieldIndex(source: ConversionSource, start: number, end: number): ConversionFieldIndex {
  const story = source.header.stories.find(story => story.start <= start && start < story.end && end <= story.end)
  requireDoc(story, 'invalid-field-data', 'Field scope has no owning source document part')
  const state = source.fieldState
  let value = state.indexes.get(story.kind)
  if (!value) {
    try {
      const index = readFieldIndex(source.table, source.header, source.storage, story, source.limits, state.indexed)
      value = { source: index, begins: new Map(index.entries.map(entry => [entry.start, entry])),
        separators: new Map(index.entries.flatMap(entry => entry.separator === null ? [] : [[entry.separator, entry]])),
        ends: new Map(index.entries.map(entry => [entry.end - 1, entry])) }
    } catch (error) {
      if (!(error instanceof DocReadError) || error.code !== 'invalid-field-data') throw error
      value = error
    }
    state.indexes.set(story.kind, value)
  }
  if (value instanceof DocReadError) throw value
  return value
}

/**
 * Builds nearest-cell ownership once without rescanning every aggregate for each note.
 * @param source - Canonical table and paragraph index space.
 * @returns Exact cell identities for directly owned paragraphs; outer flow is absent.
 */
export function fieldParagraphCells(source: ConversionSource): ReadonlyMap<number, DocTableCell> {
  let cells = source.fieldState.cells.get(source)
  if (!cells) {
    const result = new Map<number, DocTableCell>()
    for (const table of source.tables) for (const row of table.rows) for (const cell of row.cells)
      for (const block of cell.blocks) if (block.kind === 'paragraph') result.set(block.index, cell)
    cells = result
    source.fieldState.cells.set(source, cells)
  }
  return cells
}

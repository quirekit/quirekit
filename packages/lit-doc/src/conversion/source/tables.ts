import { requireDoc, type DocReadError } from '../../errors'
import type { PropertyOperation } from '../../word/properties/types'
import { readTables } from '../../word/tables/read'
import type { DocTable } from '../../word/tables/types'
import { findSourceInterval } from './lookup'
import type { ConversionSource, ConversionStorySource } from './types'
import type { ProjectionContext } from '../xml/types'
import { recoverStorySource } from './policy'

/**
 * Isolates table topology by story while retaining the aggregate paragraph and run authorities.
 * @param source - Canonical aggregate formatting, scanned once.
 * @param stories - Validated independent story boundaries.
 * @param refusals - Known source failures collected for exact per-story fallback.
 * @param context - Explicit loss policy.
 * @returns One aggregate table collection with stable source paragraph references.
 */
export function readStoryTables(source: ConversionStorySource, stories: readonly { start: number, end: number }[],
  refusals: Map<number, DocReadError>, context: ProjectionContext): ConversionSource {
  const tables: DocTable[] = []
  const tableRowOperations = new Map<number, readonly PropertyOperation[]>()
  for (const story of stories) {
    if (story.start === story.end) continue
    try {
      const start = findSourceInterval(source.paragraphs, story.start)
      const end = findSourceInterval(source.paragraphs, story.end)
      requireDoc(source.paragraphs[start]?.start === story.start && source.paragraphs[end - 1]?.end === story.end,
        'invalid-story-data', 'Story boundaries split canonical paragraphs')
      const rows = new Map<number, readonly PropertyOperation[]>()
      const topology = readTables(source.table, source.header, source.storage, source.paragraphs.slice(start, end), source.context.reader,
        source.limits, rows, start, source.allocations.tables)
      source.context.diagnostics.push(...topology.diagnostics.filter(diagnostic => diagnostic.code === 'implicit-table-depth'))
      // Each table collection is complete before local table references are moved
      // into the aggregate index space. Paragraph indexes already use that space.
      const offset = tables.length
      for (const table of topology.tables) {
        if (table.parent) table.parent.tableIndex += offset
        for (const row of table.rows) for (const cell of row.cells) for (const block of cell.blocks)
          if (block.kind === 'table') block.index += offset
      }
      tables.push(...topology.tables)
      for (const [start, operations] of rows) tableRowOperations.set(start, operations)
    } catch (error) {
      if (!recoverStorySource(error, context)) throw error
      refusals.set(story.start, error)
    }
  }
  return { ...source, tables, tableRowOperations,
    topTables: tables.flatMap((value, index) => value.parent ? [] : [{ index, start: value.start, end: value.end }]) }
}

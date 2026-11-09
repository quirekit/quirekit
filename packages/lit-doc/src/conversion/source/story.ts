import { readParagraphRecords } from '../../word/paragraphs/read'
import { readParagraphFormats } from '../../word/paragraphs/formatting/read'
import type { ParagraphNumberingState } from '../../word/numbering/types'
import { readCharacterSources } from '../../word/characters/source'
import { resolveCharacterFormats } from '../../word/characters/read'
import { readTables } from '../../word/tables/read'
import type { PropertyOperation } from '../../word/properties/types'
import type { CharacterPropertyKey, CharacterToggleModes } from '../../word/characters/formatting/types'
import type { ParagraphPropertyKey } from '../../word/paragraphs/formatting/types'
import type { DocReadLimits, DocStoryRange } from '../../types'
import type { ConversionDocumentSource, ConversionSource, ConversionStorySource } from './types'
import { readRevisionRuns } from '../../word/revisions'

/**
 * Resolves a complete subdocument once with shared styles and property work budgets.
 * @param source - Document-wide immutable authorities and shared style resolver.
 * @param story - Absolute CP range, including every source paragraph guard.
 * @param limits - Remaining paragraph, run and table allocations for this document.
 * @returns Canonical story arrays retaining original CPs and local table indexes.
 */
export function readStoryFormatting(source: ConversionDocumentSource, story: DocStoryRange,
  limits: DocReadLimits = source.limits): ConversionStorySource {
  const { word, table, header, storage, context, paragraphStyles } = source
  const paragraphs = readParagraphRecords(word, table, header, storage, limits, story, source.allocations.paragraphs,
    context.recoverProperties ? context.diagnostics : undefined)
  const paragraphFields = paragraphs.map(() => new Set<ParagraphPropertyKey>())
  const paragraphNumbering: ParagraphNumberingState[] = []
  const paragraphFormats = readParagraphFormats(storage, paragraphs, context, limits, paragraphFields, paragraphNumbering, paragraphStyles)
  const sources = readCharacterSources(word, table, header, storage, paragraphs, limits, source.allocations.characterRuns, context.diagnostics)
  const runFields = sources.map(() => new Set<CharacterPropertyKey>())
  const runToggleModes = sources.map((): CharacterToggleModes => new Map())
  const runOperations: (readonly PropertyOperation[])[] = []
  const runs = resolveCharacterFormats(sources, storage, paragraphs, context, limits, runFields, runToggleModes, runOperations, paragraphFormats)
  const runRevisions = readRevisionRuns(runs, runOperations, context.reader)
  return { ...source, paragraphs, paragraphFormats, paragraphFields, paragraphNumbering, runs, runFields, runToggleModes, runOperations, runRevisions }
}

/**
 * Adds complete table topology to one already bounded source subdocument.
 * @param source - Shared document authorities.
 * @param story - Absolute content interval.
 * @param limits - Remaining allocations.
 * @returns Canonical arrays with stable paragraph and table indexes.
 */
export function readStorySource(source: ConversionDocumentSource, story: DocStoryRange,
  limits: DocReadLimits = source.limits): ConversionSource {
  const content = readStoryFormatting(source, story, limits)
  const { table, header, storage, context, paragraphs } = content
  const tableRowOperations = new Map<number, readonly PropertyOperation[]>()
  const { tables, diagnostics } = readTables(table, header, storage, paragraphs, context.reader, limits, tableRowOperations, 0, source.allocations.tables)
  context.diagnostics.push(...diagnostics.filter(diagnostic => ['implicit-table-depth', 'redundant-nested-table-frame'].includes(diagnostic.code)))
  return { ...content, tables, tableRowOperations,
    topTables: tables.flatMap((value, index) => value.parent ? [] : [{ index, start: value.start, end: value.end }]) }
}

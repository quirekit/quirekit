import { ByteView } from '../../binary/bytes'
import { readDocumentSource } from '../../word/document/read'
import { createFormattingContext } from '../../word/formatting/context'
import { readFontRecords } from '../../word/fonts/read'
import { createParagraphStyles } from '../../word/paragraphs/formatting/styles'
import type { DocConversionOptions } from '../types'
import { readStorySource } from './story'
import { createFieldState } from '../fields/source'
import { readBookmarkRecords } from '../../word/bookmarks'
import type { ConversionSource } from './types'
import type { WordDocumentSource } from '../../word/document/types'

/**
 * Shares the same validated source authorities and format interpreters with inspection.
 * @param input - Complete original DOC bytes.
 * @param options - Source limits and conversion policy.
 * @returns One privately owned snapshot with direct-field provenance.
 */
export function readConversionSource(input: Uint8Array, options: DocConversionOptions): ConversionSource {
  return createConversionSource(readDocumentSource(input, options))
}

/**
 * Resolves rich source authorities from an already privately owned text snapshot.
 * @param source - Validated container, FIB and text storage shared with possible recovery.
 * @param recover - Whether default conversion permits bounded local structural-property recovery.
 * @returns Complete formatting and topology, or a located source failure.
 */
export function createConversionSource(source: WordDocumentSource, recover = false): ConversionSource {
  const { container, word, table, header, storage, limits } = source
  const data = container.readRootStream('Data')
  const context = createFormattingContext(table, data, header, limits, true, recover)
  const range = header.records[15]!
  const fonts = readFontRecords(new ByteView(table, 'invalid-formatting-data').slice(range.offset, range.length))
  const paragraphStyles = createParagraphStyles(context, limits, true)
  const allocations = { paragraphs: { remaining: limits.maxParagraphs }, characterRuns: { remaining: limits.maxCharacterRuns },
    tables: { remaining: limits.maxTables } }
  return readStorySource({ ...source, data, context, fonts, paragraphStyles, allocations, revisionState: { nextId: 0 }, fieldState: createFieldState(limits),
    bookmarkState: { source: readBookmarkRecords(table, header, limits, context.diagnostics), attempted: new Set() } }, header.stories[0]!)
}

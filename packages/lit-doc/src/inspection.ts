import { readDocumentSource } from './word/document/read'
import { readTables } from './word/tables/read'
import { createPropertyReader } from './word/properties/reader'
import type { DocInspection, DocReadDiagnostic, DocReadOptions } from './types'
import { readParagraphRecords } from './word/paragraphs/read'
import { readParagraphFormats } from './word/paragraphs/formatting/read'
import { createFormattingContext } from './word/formatting/context'
import { readCharacterFormats } from './word/characters/read'
import { readNumberingRecords } from './word/numbering/records'
import { resolveParagraphNumbering } from './word/numbering/references'
import type { ParagraphNumberingState } from './word/numbering/types'
import { readHeaderFooterRecords } from './word/header-footer'
import { readNoteRecords } from './word/notes'
import { readNoteSettings } from './word/notes/settings/read'
import { readFieldRecords } from './word/fields'
import { readBookmarkRecords } from './word/bookmarks'
import { readCommentRecords } from './word/comments'
import { readRevisionAuthors, readRevisionRuns } from './word/revisions'
import type { PropertyOperation } from './word/properties/types'
import { readDrawingRecords } from './word/drawings'
import { readTextboxRecords } from './word/textboxes'

/**
 * Inspects DOC text storage without projecting controls or formatting into editor nodes.
 * @param input - Complete original file bytes; the caller's buffer is retained unchanged.
 * @param options - Bounded resource policy.
 * @returns Source text, pieces, and subdocument intervals; not a LitAST document.
 */
export function inspectDoc(input: Uint8Array, options: DocReadOptions = {}): DocInspection {
  const source = readDocumentSource(input, options)
  const { container, word, header, table, storage, limits } = source
  const headerDiagnostics: DocReadDiagnostic[] = []
  const headerFooters = options.includeHeaderFooters ? readHeaderFooterRecords(table, header, storage, limits, headerDiagnostics) : undefined
  const notes = options.includeNotes ? readNoteRecords(table, header, storage, limits) : undefined
  const fields = options.includeFields ? readFieldRecords(table, header, storage, limits) : undefined
  const bookmarks = options.includeBookmarks ? readBookmarkRecords(table, header, limits, headerDiagnostics) : undefined
  const comments = options.includeComments ? readCommentRecords(table, header, storage, limits) : undefined
  const revisionAuthors = options.includeRevisionAuthors || options.includeRevisions ? readRevisionAuthors(table, header, limits, headerDiagnostics) : undefined
  const includeCharacters = options.includeCharacterFormatting || options.includeRevisions
  const numbering = options.includeNumbering ? { scope: 'numbering-source' as const, ...readNumberingRecords(table, header, limits) } : undefined
  const numberingStates: ParagraphNumberingState[] | undefined = numbering ? [] : undefined
  const records = options.includeParagraphs || options.includeParagraphFormatting || includeCharacters || options.includeTables || options.includeNumbering
    ? readParagraphRecords(word, table, header, storage, limits) : undefined
  const context = options.includeParagraphFormatting || includeCharacters || options.includeNumbering
    ? createFormattingContext(table, container.readRootStream('Data'), header, limits, includeCharacters === true) : undefined
  const formats = context ? readParagraphFormats(storage, records!, context, limits, undefined, numberingStates) : undefined
  const revisionOperations: (readonly PropertyOperation[])[] | undefined = options.includeRevisions ? [] : undefined
  const characterRuns = includeCharacters
    ? readCharacterFormats(word, table, header, storage, records!, context!, limits, revisionOperations, formats) : undefined
  const revisions = revisionOperations ? { scope: 'main-story-revision-source' as const, authors: revisionAuthors!,
    runs: readRevisionRuns(characterRuns!, revisionOperations, context!.reader) } : undefined
  const reader = context?.reader ?? (options.includeTables || options.includeNoteSettings
    ? createPropertyReader(container.readRootStream('Data'), limits) : options.includeTextboxes ? createPropertyReader(undefined, limits) : undefined)
  const tables = options.includeTables ? readTables(table, header, storage, records!, reader!, limits) : undefined
  const drawings = options.includeDrawings ? readDrawingRecords(source, reader, headerDiagnostics) : undefined
  const textboxes = options.includeTextboxes ? readTextboxRecords(source, reader!) : undefined
  if (context && tables) context.diagnostics.push(...tables.diagnostics.filter(diagnostic => diagnostic.code === 'implicit-table-depth'))
  const noteSettings = options.includeNoteSettings ? readNoteSettings(source, reader!) : undefined
  const paragraphs = records?.map(({ start, end, ending }, index) => ({ start, end, ending,
    ...(formats ? { baseFormat: formats[index]! } : {}),
    ...(numbering ? { numbering: resolveParagraphNumbering(numberingStates![index]!, numbering) } : {}) }))
  return {
    scope: 'text-storage', containerVersion: container.version, version: header.version, tableStream: header.tableStream,
    text: storage.text, stories: header.stories, ...(tables ? { tables: tables.tables } : {}), ...(paragraphs ? { paragraphs } : {}), ...(characterRuns ? { characterRuns } : {}),
    ...(numbering ? { numbering } : {}),
    ...(headerFooters ? { headerFooters } : {}),
    ...(notes ? { notes } : {}),
    ...(noteSettings ? { noteSettings } : {}),
    ...(fields ? { fields } : {}),
    ...(bookmarks ? { bookmarks } : {}),
    ...(comments ? { comments } : {}),
    ...(revisionAuthors ? { revisionAuthors } : {}),
    ...(revisions ? { revisions } : {}),
    ...(drawings ? { drawings } : {}),
    ...(textboxes ? { textboxes } : {}),
    diagnostics: [...container.diagnostics, ...header.diagnostics, ...headerDiagnostics, ...(context?.diagnostics ?? tables?.diagnostics ?? []), ...(paragraphs ? [{
      code: formats ? 'paragraph-formatting-partial' as const : 'paragraph-formatting-unresolved' as const,
      message: formats ? 'Paragraph base settings exclude list/table styles, character formatting and final layout; unhandled opcodes remain listed.'
        : tables ? 'Main-story paragraph boundaries and table membership are inspected; styles and character formatting remain unresolved.'
          : 'Main-story paragraph boundaries are inspected; styles, character formatting and table roles remain unresolved.',
    }] : []), ...(characterRuns ? [{ code: 'character-formatting-partial' as const,
      message: 'Character base settings exclude list/table styles, font/script selection, document objects and final layout; unhandled opcodes remain listed.',
    }] : []), ...(tables ? [{ code: 'table-formatting-unresolved' as const,
      message: 'Source table membership excludes effective geometry, merge semantics, styles and final layout; row operations remain listed.',
    }] : []), ...(numbering ? [{ code: 'numbering-formatting-unresolved' as const,
      message: 'Source numbering records and paragraph references exclude effective level properties, marker evaluation and persistent editor support.',
    }] : []), ...(notes ? [{ code: 'note-formatting-unresolved' as const,
      message: 'Note source indexes retain anchors and content ranges; character flags, numbering, rich content and persistent editor conversion require separate interpretation.',
    }] : []), ...(fields ? [{ code: 'field-formatting-unresolved' as const,
      message: 'Source field indexes preserve raw positions and end flags; character flags, instruction semantics and cached results require separate interpretation.',
    }] : []), ...(bookmarks ? [{ code: 'bookmark-projection-unresolved' as const,
      message: 'Bookmark source indexes retain names, absolute CPs and raw hints; actual Story ownership and editor projection require separate interpretation.',
    }] : []), ...(comments ? [{ code: 'comment-formatting-unresolved' as const,
      message: 'Source comment indexes retain authors, references, ranges and optional extensions; character flags, rich-body conversion and host support require separate interpretation.',
    }] : []), ...(revisionAuthors ? [{ code: 'revision-content-unresolved' as const,
      message: revisions ? 'Main-story source revision flags and raw operands are inspected; persistent revision objects, auxiliary Stories and editor decisions require their own interpretation.'
        : 'Revision-author source names and slots are inspected; content flags, timestamps, revision objects and editor decisions require their own interpretation.',
    }] : []), ...(drawings ? [{ code: 'drawing-formatting-unresolved' as const,
      message: 'Floating drawing anchors, shapes and raw property layers are inspected; effective defaults, character flags, media decoding and persistent editor conversion require their own interpretation.',
    }] : []), ...(textboxes ? [{ code: 'textbox-formatting-unresolved' as const,
      message: 'Original textbox chain descriptors and cached display fragments are inspected; shape association, effective formatting and persistent editor conversion require their own interpretation.',
    }] : [])],
    pieces: storage.pieces.map(({ start, end, byteOffset, byteLength, unicode }) => ({ start, end, byteOffset, byteLength, unicode })),
  }
}

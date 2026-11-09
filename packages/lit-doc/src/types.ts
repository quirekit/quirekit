import type { DocTable } from './word/tables/types'
import type { DocNumberingSource, DocParagraphNumbering } from './word/numbering/types'
import type { DocParagraphTabs } from './word/paragraphs/formatting/tabs/types'
import type { DocHeaderFooterSource } from './word/header-footer/types'
import type { DocNotesSource } from './word/notes/types'
import type { DocNoteSettingsSource } from './word/notes/settings/types'
import type { DocFieldsSource } from './word/fields/types'
import type { DocBookmarksSource } from './word/bookmarks/types'
import type { DocCommentsSource } from './word/comments/types'
import type { DocRevisionAuthorsSource, DocRevisionsSource } from './word/revisions/types'
import type { DocDrawingsSource } from './word/drawings/types'
import type { DocTextboxesSource } from './word/textboxes/types'
/** Resource ceilings applied before allocating document-derived structures. */
export interface DocReadLimits {
  /** Maximum descriptors and display fragments across both textbox parts; defaults to 10000. */
  maxTextboxEntries: number
  /** Maximum source drawing shapes and anchors per inspection; defaults to 10000. */
  maxDrawings: number
  /** Maximum nested OfficeArt containers; defaults to 64. */
  maxDrawingDepth: number
  /** Maximum copied complex drawing property bytes; defaults to 8 MiB. */
  maxDrawingPropertyBytes: number
  /** Maximum original revision-author slots; defaults to 10000. */
  maxRevisionAuthors: number
  /** Maximum combined UTF-16 units in revision-author names; defaults to 1 Mi. */
  maxRevisionAuthorCodeUnits: number
  /** Maximum comment references or annotation ranges; defaults to 10000. */
  maxComments: number
  /** Maximum original comment authors; defaults to 10000. */
  maxCommentAuthors: number
  /** Maximum comment tree levels, including the root; defaults to 64. */
  maxCommentDepth: number
  /** Maximum standard bookmarks; defaults to 10000 with a format ceiling of 0x3FFC. */
  maxBookmarks: number
  /** Maximum indexed fields across all document parts; defaults to 10000. */
  maxFields: number
  /** Maximum nested fields in one source index or converted story; defaults to 64. */
  maxFieldDepth: number
  /** Maximum footnotes and endnotes combined; defaults to 10000. */
  maxNotes: number
  /** Maximum header/footer and note-separator slots, including empty slots; defaults to 10000. */
  maxHeaderFooterStories: number
  /** Maximum inline and floating picture occurrences together; defaults to 10000. */
  maxPictures: number
  /** Maximum decoded bytes per picture; defaults to 16 MiB. */
  maxPictureBytes: number
  /** Maximum decoded bytes and total bytes across picture occurrences; defaults to 64 MiB. */
  maxTotalPictureBytes: number
  /** Maximum complete input size, in bytes; defaults to 64 MiB. */
  maxInputBytes: number
  /** Maximum directory slots, including unallocated slots; defaults to 65536. */
  maxDirectoryEntries: number
  /** Maximum total UTF-16 code units, including story terminators; defaults to 8 Mi. */
  maxTextCodeUnits: number
  /** Maximum text pieces; defaults to 200000. */
  maxPieces: number
  /** Maximum inspected main-story paragraphs; defaults to 200000. */
  maxParagraphs: number
  /** Maximum formatting-index entries/pages, combined when characters are requested; defaults to 16384. */
  maxFormattingPages: number
  /** Maximum property reads/applications per inspection; defaults to 1000000. */
  maxPropertyOperations: number
  /** Maximum style or indirect-property chain depth; defaults to 64. */
  maxFormattingDepth: number
  /** Maximum inspected main-story character runs; defaults to 200000. */
  maxCharacterRuns: number
  /** Maximum source table nesting depth; defaults to 32. */
  maxTableDepth: number
  /** Maximum source tables in the main story; defaults to 10000. */
  maxTables: number
  /** Maximum list definitions; defaults to 4096. */
  maxNumberingDefinitions: number
  /** Maximum list instances, including unused instances; defaults to 4096. */
  maxNumberingInstances: number
  /** Maximum definition and complete-override levels combined; defaults to 65536. */
  maxNumberingLevels: number
  /** Maximum total UTF-16 template units; defaults to 1 Mi. */
  maxNumberingTextCodeUnits: number
}

/** Options shared by synchronous and worker-based inspection. */
export interface DocReadOptions {
  /** Also inspect original textbox chain and display metadata without resolving drawing/text formatting. */
  includeTextboxes?: boolean
  /** Also inspect floating drawing anchors, original property layers and group membership without decoding media. */
  includeDrawings?: boolean
  /** Also inspect complete main-story revision states, implying authors and character/paragraph formatting. */
  includeRevisions?: boolean
  /** Also inspect the original revision-author table without loading character formatting. */
  includeRevisionAuthors?: boolean
  /** Also inspect source comment membership, authors, ranges and optional thread extensions. */
  includeComments?: boolean
  /** Also inspect standard bookmark names, absolute ranges and original BKC hints. */
  includeBookmarks?: boolean
  /** Also inspect all seven field indexes, without resolving character flags or instructions. */
  includeFields?: boolean
  /** Per-call resource ceilings within the library's hard limits. */
  limits?: Partial<DocReadLimits>
  /** Also inspect main-story paragraph boundaries; formatting values remain unresolved. */
  includeParagraphs?: boolean
  /** Also inspect paragraph base formatting, implicitly including paragraph boundaries. */
  includeParagraphFormatting?: boolean
  /** Also inspect main-story character base settings, including paragraph base inspection. */
  includeCharacterFormatting?: boolean
  /** Also inspect main-story table topology, implicitly including paragraph boundaries. */
  includeTables?: boolean
  /** Also inspect numbering source records and references, including paragraph base inspection. */
  includeNumbering?: boolean
  /** Also inspect header/footer and note-separator source ranges without resolving their formatting. */
  includeHeaderFooters?: boolean
  /** Also inspect footnote/endnote reference indexes and content ranges without resolving their formatting. */
  includeNotes?: boolean
  /** Also inspect version-selected document and section note numbering/placement independently of content indexes. */
  includeNoteSettings?: boolean
}

/** Stable source-validation failures, including causes recorded by diagnosed conversion recovery. */
export type DocReadErrorCode =
  | 'invalid-input' | 'unsupported-container' | 'invalid-cfb' | 'not-word-document'
  | 'encrypted-document' | 'unsupported-version' | 'invalid-fib' | 'invalid-text-map'
  | 'invalid-paragraph-data' | 'invalid-table-data' | 'unsupported-table' | 'invalid-story-data'
  | 'invalid-picture-data' | 'unsupported-picture'
  | 'invalid-drawing-data'
  | 'invalid-formatting-data' | 'unsupported-formatting'
  | 'invalid-numbering-data' | 'unsupported-numbering'
  | 'invalid-field-data' | 'unsupported-field'
  | 'invalid-bookmark-data'
  | 'invalid-comment-data'
  | 'invalid-revision-data'
  | 'limit-exceeded' | 'aborted' | 'timeout' | 'worker-failed'

/** One physical text span mapped onto the document's logical character positions. */
export interface DocTextPiece {
  /** Inclusive logical UTF-16 code-unit position. */
  start: number
  /** Exclusive logical UTF-16 code-unit position. */
  end: number
  /** Byte position relative to the WordDocument stream. */
  byteOffset: number
  /** Source byte length, distinct from the character length. */
  byteLength: number
  /** Whether the source stores little-endian 16-bit code units. */
  unicode: boolean
}

/** Source subdocument categories; header means the aggregate header/footer storage. */
export type DocStoryKind = 'main' | 'footnote' | 'header' | 'comment' | 'endnote' | 'textbox' | 'headerTextbox'

/** A source subdocument's character interval, without interpreting its objects. */
export interface DocStoryRange {
  /** Subdocument category. */
  kind: DocStoryKind
  /** Inclusive position in the concatenated source text. */
  start: number
  /** Exclusive position; any global trailing terminator is outside the story. */
  end: number
}

/** A source compatibility decision or explicitly unresolved inspection capability. */
export interface DocReadDiagnostic {
  /** Stable compatibility or capability condition. */
  code: 'missing-fib-version-extension' | 'stale-header-directory' | 'extended-fib-regions' | 'root-name-case-variant' | 'root-label-ignored' | 'fat-sector-end-marker' | 'paragraph-formatting-unresolved' | 'paragraph-formatting-partial'
    | 'cfb-header-constants' | 'cfb-partial-last-sector'
    | 'cfb-unused-difat-entries' | 'cfb-unused-allocation-pointer' | 'cfb-unreadable-streams-omitted'
    | 'cfb-allocation-count-recovered' | 'cfb-allocation-marker-recovered' | 'cfb-unmapped-file-tail'
    | 'cfb-chain-tail-ignored' | 'cfb-stream-truncated' | 'cfb-directory-recovered'
    | 'cfb-root-type-recovered' | 'cfb-flat-directory-recovered'
    | 'fib-locator-prefix-recovered' | 'fib-length-hint-ignored' | 'text-map-range-recovered'
    | 'character-formatting-partial' | 'table-formatting-unresolved' | 'numbering-formatting-unresolved' | 'note-formatting-unresolved' | 'extended-stylesheet-range' | 'legacy-style-tab-operation' | 'implicit-table-depth'
    | 'legacy-style-script-hint' | 'legacy-paragraph-style-highlight' | 'character-style-highlight-ignored'
    | 'legacy-style-frame-overlap'
    | 'property-tail-omitted' | 'indirect-property-omitted' | 'indirect-property-compatibility'
    | 'paragraph-properties-defaulted'
    | 'table-definition-length-compatibility'
    | 'terminal-character-format-absent' | 'implicit-rtl-style-inversion' | 'legacy-zero-font-size'
    | 'field-formatting-unresolved' | 'redundant-nested-table-frame'
    | 'bookmark-projection-unresolved' | 'bookmark-equivalent-end-index'
    | 'comment-formatting-unresolved'
    | 'revision-content-unresolved' | 'revision-unknown-author-name-variant' | 'revision-author-empty-directory'
    | 'drawing-formatting-unresolved' | 'drawing-media-count-variant'
    | 'textbox-formatting-unresolved'
  /** Explanation of the source condition and bounded handling. */
  message: string
}

/** Storage-level inspection, deliberately distinct from a LitAST document. */
export interface DocInspection {
  /** Declares source inspection rather than a persistent editor or converted document. */
  scope: 'text-storage'
  /** CFB major version, either 3 or 4. */
  containerVersion: number
  /** Effective FIB version after applying the optional newer-version field. */
  version: number
  /** The root table stream selected by the FIB. */
  tableStream: '0Table' | '1Table'
  /** Pieces in logical character order, not physical file order. */
  pieces: readonly DocTextPiece[]
  /** Raw code units, preserving paragraph, field, table, and object controls. */
  text: string
  /** All seven subdocument intervals, including empty ones. */
  stories: readonly DocStoryRange[]
  /** Main-story boundaries when explicitly requested; includes each terminating code unit. */
  paragraphs?: readonly DocParagraphBoundary[]
  /** Main-story character settings when explicitly requested. */
  characterRuns?: readonly DocCharacterRun[]
  /** Main-story source table topology when requested, without effective table formatting. */
  tables?: readonly DocTable[]
  /** Source numbering records when requested; no marker evaluation or effective level properties. */
  numbering?: DocNumberingSource
  /** Header/footer source slots and document parity flag when explicitly requested. */
  headerFooters?: DocHeaderFooterSource
  /** Footnote/endnote source indexes when explicitly requested. */
  notes?: DocNotesSource
  /** Document and section note settings when explicitly requested. */
  noteSettings?: DocNoteSettingsSource
  /** All document-part field indexes when explicitly requested; character flags remain unresolved. */
  fields?: DocFieldsSource
  /** Standard bookmark source ranges when explicitly requested, without editor projection. */
  bookmarks?: DocBookmarksSource
  /** Source comments when explicitly requested, without formatting or persistent host conversion. */
  comments?: DocCommentsSource
  /** Original revision-author slots, present only when explicitly requested. */
  revisionAuthors?: DocRevisionAuthorsSource
  /** Main-story revision flags and independent operands when explicitly requested. */
  revisions?: DocRevisionsSource
  /** Floating drawing source graph when explicitly requested, without native drawing-conversion admission. */
  drawings?: DocDrawingsSource
  /** Original textbox-chain and cached display tables, present only when requested. */
  textboxes?: DocTextboxesSource
  /** Source compatibility decisions and unresolved inspection capabilities. */
  diagnostics: readonly DocReadDiagnostic[]
}

/** A main-story source paragraph, without resolved style, formatting or table topology. */
export interface DocParagraphBoundary {
  /** Inclusive logical UTF-16 position. */
  start: number
  /** Exclusive logical position, including the terminating marker. */
  end: number
  /** Source marker class; cell versus row needs later table-property interpretation. */
  ending: 'paragraph' | 'section' | 'cell-or-row'
  /** Optional derived base settings; excludes list/table styles and final layout. */
  baseFormat?: DocParagraphBaseFormat
  /** Source list reference when requested, before marker or indentation resolution. */
  numbering?: DocParagraphNumbering
}

/** Source alignment value retaining the distinction between physical and logical justification. */
export interface DocParagraphAlignment {
  /** MS-DOC justification code; old physical values and new logical values have distinct meanings. */
  value: number
  /** True for logical justification; false for legacy physical justification. */
  logical: boolean
}

/** Source horizontal distance with the basis in which it was specified. */
export interface DocParagraphIndent {
  /** Signed distance in twentieths of a point. */
  twips: number
  /** True for logical left/right; false for physical left/right. */
  logical: boolean
}

/** Source LSPD settings, before font metrics, grid and layout are applied. */
export interface DocParagraphLineSpacing {
  /** Negative means exact twips; nonnegative uses the multiple flag. */
  value: number
  /** True uses value/240 line multiples; false uses a minimum twip distance for nonnegative values. */
  multiple: boolean
}

/** Derived paragraph settings from defaults, paragraph styles, PAPX and the ending piece only. */
export interface DocParagraphBaseFormat {
  /** Deliberately excludes table/list formatting and final layout. */
  scope: 'paragraph-base'
  /** Source paragraph style index; not a persistent editor style identifier. */
  styleIndex: number
  /** Zero-based outline level 0..8, or 9 for body text; independent of list depth. */
  outlineLevel: number
  /** Source justification and its physical/logical basis. */
  alignment: DocParagraphAlignment
  /** Left indent setting, before character-unit or mirror-indent handling. */
  leftIndent: DocParagraphIndent
  /** Right indent setting, before character-unit or mirror-indent handling. */
  rightIndent: DocParagraphIndent
  /** Signed first-line distance relative to the remaining lines. */
  firstLineIndentTwips: number
  /** Configured twips before the paragraph; auto/line/contextual spacing is not evaluated. */
  spacingBeforeTwips: number
  /** Configured twips after the paragraph; auto/line/contextual spacing is not evaluated. */
  spacingAfterTwips: number
  /** Unconverted line-spacing settings. */
  lineSpacing: DocParagraphLineSpacing
  /** Effective custom stops and the distinct edits owned by the current formatting layer. */
  tabs: DocParagraphTabs
  /** Complete source paragraph shading, or null when no source layer supplies it. */
  shading: import('./word/formatting/shading/types').DocShading | null
  /** Requests that the paragraph's lines stay on one page. */
  keepLines: boolean
  /** Requests keeping the paragraph end with the next paragraph start. */
  keepNext: boolean
  /** Explicit paragraph page break request. */
  pageBreakBefore: boolean
  /** Whether widow and orphan control is enabled. */
  widowControl: boolean
  /** Whether paragraph layout is right-to-left. */
  bidi: boolean
  /** Whether East Asian and Latin text receives automatic spacing; the DOC default is true. */
  autoSpaceLatin: boolean
  /** Whether East Asian text and numbers receive automatic spacing; the DOC default is true. */
  autoSpaceNumber: boolean
  /** Sorted unique operations encountered but outside this base-settings interpretation. */
  unsupportedOpcodes: readonly number[]
}
import type { DocCharacterRun } from './word/characters/types'

import type { DocStoryKind } from '../../types'
import type { BookmarkTableFixture } from '../bookmarks/types'
import type { DrawingDocumentFixture } from '../drawings/types'
import type { TextboxPartVector } from '../textboxes/types'

/** One independently encoded field PLC, before semantic interpretation. */
export interface FieldTableFixture {
  /** Document part owning the relative positions. */
  kind: DocStoryKind
  /** Exact marker positions and raw two-byte records. */
  tokens: readonly { position: number, code: number, value: number }[]
  /** Undefined final CP, defaulting beyond the last real marker. */
  terminal?: number
}

/** Independent content and property vectors for the actual conversion entry point. */
export interface FieldDocumentOptions {
  /** Independent optional Data stream shared by original picture locators. */
  data?: Uint8Array
  /** Explicit original seven-part subdocument lengths. */
  storyLengths?: readonly number[]
  /** Independent textbox chain and display tables. */
  textboxes?: readonly TextboxPartVector[]
  /** Independent floating drawing containers and anchor tables. */
  drawings?: DrawingDocumentFixture
  /** Optional independent source revision authors for reviewed field and plain-text vectors. */
  revisionAuthors?: readonly string[]
  /** Independently authored standard bookmark tables. */
  bookmarks?: BookmarkTableFixture
  /** Explicit source field PLCs; absent means no indexed field metadata. */
  tables?: readonly FieldTableFixture[]
  /** Source character spans and complete property bytes. */
  characters?: readonly { start: number, end: number, operations: readonly number[] }[]
  /** Source paragraph property spans, including optional table membership. */
  paragraphs?: readonly { start: number, end: number, operations: readonly number[] }[]
}

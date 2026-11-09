import type { DocxPackagePartPlan, DocxRelationshipPlan, DocxResourcePlan, DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocReadError } from '../../errors'
import type { DocCommentEntry } from '../../word/comments/types'
import type { PictureProjection } from '../pictures/types'
import type { ConversionSource } from '../source/types'

/** Validated original membership and once-read aggregate comment formatting. */
export interface CommentInput {
  /** Complete original messages, empty after an explicitly diagnosed directory refusal. */
  entries: readonly DocCommentEntry[]
  /** Successfully read aggregate, absent after a source-formatting refusal. */
  content?: ConversionSource
  /** Per-message table topology refusals using absolute message starts. */
  refusals: ReadonlyMap<number, DocReadError>
}

/** Ordered main-body boundary producer, separate from run-owned references. */
export interface CommentBoundaryProjection {
  /** @param position - Exact source CP. @param inField - Open field/code/cache ownership. @returns Paragraph-level range boundaries. */
  at(position: number, inField: boolean): DocxXmlElementPlan[]
  /** @param end - Next character/paragraph limit. @returns Earlier range event or the unchanged limit. */
  next(end: number): number
}

/** Exact U+0005 owner for either main references or one message's self marker. */
export interface CommentControlProjection {
  /** Source runs whose controls were consumed by this owner. */
  handledRuns: Set<number>
  /** Main-story range events, absent for a message-body self-marker owner. */
  boundaries?: CommentBoundaryProjection
  /** @param position - Absolute original CP. @param runIndex - Canonical source run. @param inField - Open field ownership. @returns Typed reference/self marker, null for a diagnosed non-native reply anchor, or undefined for an unadmitted control. */
  project(position: number, runIndex: number, inField: boolean): DocxXmlElementPlan | null | undefined
}

/** Disposable complete message whose resources depend on whole-thread admission. */
export interface PendingCommentOutput {
  /** Original range, actor, timestamp and parent authority. */
  source: DocCommentEntry
  /** Complete typed comment body. */
  element: DocxXmlElementPlan
  /** Message-local media and relationship staging. */
  media: PictureProjection
  /** Whether displayed main flow consumed the exact source reference. */
  referenced: boolean
  /** Number of range boundaries actually emitted. */
  boundaries: number
}

/** Atomic package graph committed only after all main-body reference/range attempts. */
export interface CommentProjection extends CommentControlProjection {
  /** Admitted comment and optional parent-join parts. */
  parts: DocxPackagePartPlan[]
  /** Admitted main and message-local relationships. */
  relationships: DocxRelationshipPlan[]
  /** Resources referenced only by admitted messages. */
  resources: DocxResourcePlan[]
  /** @param document - Complete main-story tree. @returns Main output with all refused thread markers removed. */
  finish(document: DocxXmlElementPlan): DocxXmlElementPlan
}

/** One source-ordered nonempty comment range endpoint. */
export interface CommentRangeEvent {
  /** Absolute source CP at which this marker precedes content. */
  position: number
  /** Original message slot. */
  index: number
  /** Whether the event begins its complete annotation range. */
  start: boolean
}

import type { DocxRelationshipPlan, DocxResourcePlan, DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocTextboxPart } from '../../word/textboxes/types'
import type { SourceFloatingTextbox, SourceTextboxChain } from '../../word/drawings/textboxes/types'
import type { ConversionSource } from '../source/types'
import type { PictureProjection } from '../pictures/types'

/** Original textbox subdocument with complete optional shared formatting. */
export interface TextboxInputPart {
  /** Complete raw descriptors and display fragments. */
  directory: DocTextboxPart
  /** Unique active source descriptor by original shape id, with null for ambiguous owners. */
  owners: ReadonlyMap<number, number | null>
  /** Once-read rich formatting and topology, absent on explicit source refusal. */
  content: ConversionSource | null
}

/** Document-owned textbox directory and formatting, before any output reference is reachable. */
export interface TextboxInput {
  /** One independent source owner per textbox family. */
  parts: ReadonlyMap<string, TextboxInputPart>
}

/** Atomically produced textbox drawing and its reachable resources. */
export interface TextboxProjectionResult {
  /** Complete ordinary shape and author Story. */
  drawing: DocxXmlElementPlan
  /** Successfully referenced media only. */
  resources: readonly DocxResourcePlan[]
  /** Same-OPC-owner relationships installed after complete success. */
  relationships: readonly DocxRelationshipPlan[]
}

/** Prepared author content, still unreachable until its complete outer drawing succeeds. */
export interface TextboxContentDraft {
  /** Original part/FTX identity used to reject duplicate pending claims. */
  readonly key: string
  /** Complete original author blocks. */
  readonly blocks: DocxXmlElementPlan[]
  /** Media staged privately for this original author range. */
  readonly resources: readonly DocxResourcePlan[]
  /** Media relations belonging to the actual enclosing OPC part. */
  readonly relationships: readonly DocxRelationshipPlan[]
  /** Commits the original text owner only after all drawing branches are complete. */
  commit(): void
}

/** Native text projection used by the shared floating object dispatcher. */
export interface TextboxProjection {
  /** @param box - Original validated source shape. @param pictures - Private resource scope factory. @returns Complete author content with a deferred, unique ownership claim. */
  prepare(box: SourceFloatingTextbox, pictures: (source: ConversionSource) => PictureProjection): TextboxContentDraft
  /** @param chain - Complete independently validated original frame graph. @param pictures - Private author-media scope factory. @returns One author draft and one deferred ownership claim for the entire chain. */
  prepareChain(chain: SourceTextboxChain, pictures: (source: ConversionSource) => PictureProjection): TextboxContentDraft
  /** @param box - Independently validated original frame. @param id - Unique package drawing identity. @param pictures - Isolated resource owner for the textbox content. @returns Atomic drawing graph or an explicit source error. */
  project(box: SourceFloatingTextbox, id: number, pictures: (source: ConversionSource) => PictureProjection): TextboxProjectionResult
  /** Reports original author intervals which no admitted shape reached. */
  finish(): void
}

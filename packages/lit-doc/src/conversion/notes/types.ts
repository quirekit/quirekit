import type { DocxPackagePartPlan, DocxRelationshipPlan, DocxResourcePlan, DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocReadError } from '../../errors'
import type { DocNoteRange } from '../../word/notes/types'
import type { ConversionSource } from '../source/types'
import type { PictureProjection } from '../pictures/types'

/** Validated note membership and separately resolved family aggregates. */
export interface NoteInput {
  /** Original references and content spans, empty after a diagnosed directory refusal. */
  entries: readonly DocNoteRange[]
  /** Successfully read aggregate formatting and per-note table topology. */
  contents: ReadonlyMap<DocNoteRange['kind'], ConversionSource>
  /** Recoverable per-note topology failures. */
  refusals: ReadonlyMap<number, DocReadError>
}

/** Source-control owner used by the generic ordered run projector. */
export interface NoteControlProjection {
  /** Source runs whose special note character was successfully projected. */
  handledRuns: Set<number>
  /**
   * Emits a source-owned note control exactly at its original CP.
   * @param position - Original absolute source CP.
   * @param runIndex - Canonical source run containing the control.
   * @returns Typed reference or self marker, absent for unadmitted controls.
   */
  project(position: number, runIndex: number): DocxXmlElementPlan | undefined
}

/** Staged ordinary note whose part membership depends on an actual main-body reference. */
export interface PendingNoteOutput {
  /** Original source identity and positions. */
  source: DocNoteRange
  /** Complete ordinary note, including its transport id. */
  element: DocxXmlElementPlan
  /** Successful note-local media scope, absent for an explicit blank replacement. */
  media?: PictureProjection
  /** Whether ordered main-body projection emitted this note's reference. */
  referenced: boolean
}

/** Atomic note graph installed only after the main body's displayed references are known. */
export interface NoteProjection extends NoteControlProjection {
  /** Successfully referenced note part roots. */
  parts: DocxPackagePartPlan[]
  /** Complete main-document and note-local relationships. */
  relationships: DocxRelationshipPlan[]
  /** Media referenced only by successfully projected and referenced notes. */
  resources: DocxResourcePlan[]
  /** Finalizes part membership after main-body projection. */
  finish(): void
}

import type { ConversionSource } from '../source/types'
import type { DocxRelationshipPlan, DocxResourcePlan, DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocReadDiagnostic } from '../../types'
import type { PictureReadContext, SourcePicture } from '../../word/pictures/types'
import type { FloatingPictureReader } from '../../word/drawings/pictures/types'
import type { ProjectionContext } from '../xml/types'
import type { TextboxProjection } from '../textboxes/types'

/** Per-story picture projection and its atomically registered media graph. */
export interface PictureProjection {
  /** Successfully referenced media resources. */
  resources: DocxResourcePlan[]
  /** Symbolic image relationships owned by this story part. */
  relationships: DocxRelationshipPlan[]
  /** Source runs whose object locators were handled by the picture owner. */
  handledRuns: Set<number>
  /**
   * Converts one displayed object character, with explicit refusal in best-effort mode.
   * @param position - Exact source character position.
   * @param runIndex - Canonical run owning the anchor.
   * @returns Complete drawing or an explicitly diagnosed omission.
   */
  project(position: number, runIndex: number): DocxXmlElementPlan | undefined
  /** @param position - Exact floating character CP. @param runIndex - Original resolved character owner. @returns Complete ordinary floating picture or explicitly diagnosed omission. */
  projectFloating(position: number, runIndex: number): DocxXmlElementPlan | undefined
}

/** Picture geometry in target DrawingML units, validated before media registration. */
export interface PictureGeometry {
  /** Frame width in EMU. */
  width: number
  /** Frame height in EMU. */
  height: number
  /** Left, top, right and bottom crop fractions in 1/1000-percent units. */
  crop: readonly number[]
  /** Rotation in 1/60000 degree units. */
  rotation: number
}

/** Validated occurrence media staged before its complete drawing becomes reachable. */
export interface PictureMediaDraft {
  /** Physical target geometry. */
  geometry: PictureGeometry
  /** Shared immutable original image resource. */
  resource: DocxResourcePlan
  /** Image reference in the actual containing OPC part. */
  relationship: DocxRelationshipPlan
}

/** Source-CP callback used by the generic inline control owner. */
export type ProjectInlinePicture = (position: number) => DocxXmlElementPlan | undefined

/** Shared media decoder and counters with isolated per-story relationship registration. */
export interface PictureDocumentProjection extends PictureProjection {
  /**
   * Creates a disposable output scope that shares document-wide media work budgets.
   * @param source - Canonical arrays owning this story's source runs.
   * @param sourcePart - Exact OPC part that will contain the drawing references.
   * @returns Private resources and relationships, registered only after story success.
   */
  forStory(source: ConversionSource, sourcePart: string): PictureProjection
}

/** Document-owned counters and original media readers, shared by disposable Story scopes. */
export interface PictureProjectionOwner {
  /** Optional independently prepared rich textbox content authority. */
  textboxes?: TextboxProjection
  /** Standalone textbox identity ordinal, unaffected by new group leaves. */
  textboxCount: number
  /** Textbox work attempts, including group leaves, separate from standalone identities. */
  textboxAttempts: number
  /** Actual media occurrence attempts, without charging group roots as pictures. */
  pictureAttempts: number
  /** New group/leaf/contained-media identity range and bounded group output work. */
  groupCount: number
  /** Complete output and loss-report authority. */
  context: ProjectionContext
  /** Shared source record, property and decoded-media budgets. */
  reader: PictureReadContext
  /** Original inline media reader with immutable source identity caching. */
  inline(offset: number): SourcePicture
  /** Original floating graph/media authority. */
  floating: FloatingPictureReader
  /** Historical standalone media ordinal, reserving one slot per group anchor. */
  count: number
  /** Aggregate image bytes referenced by output occurrences. */
  referencedBytes: number
  /** Compatibility decisions produced during lazy original drawing reads. */
  compatibility: DocReadDiagnostic[]
  /** Compatibility observations already sent to the bounded output report. */
  emittedCompatibility: number
}

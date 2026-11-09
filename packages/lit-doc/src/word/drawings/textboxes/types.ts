import type { FloatingPicturePlacement } from '../pictures/types'
import type { OfficeArtEffectiveProperties, OfficeArtRecord } from '../../office-art/types'

/** Shape-local text, paint and transform values, independent of a physical FSPA. */
export type TextShapeProperties = Omit<SourceFloatingTextbox, 'kind' | 'position' | 'extent' | 'placement' | 'staleClientAnchor'>

/** @param textId - Original Word text identity. @param nextShapeId - Original next-shape value. Applies the caller's original text-owner admission before reading dependent text fields. */
export type ValidateTextShapeIdentity = (textId: number, nextShapeId: number) => void

/** Original text identity and dependent property authority, before shape appearance is interpreted. */
export interface TextShapeIdentitySource {
  /** Original high descriptor slot and low frame sequence. */
  textId: number
  /** Original next shape, without treating self-reference as terminal. */
  nextShapeId: number
  /** Same effective property-use owner consumed by the shape reader. */
  properties: OfficeArtEffectiveProperties
  /** Original direct records, retained for the unique physical association. */
  children: readonly OfficeArtRecord[]
}

/** Complete ordinary same-part source chain, with no inferred author interval or cached text split. */
export interface SourceTextboxChain {
  /** Frames in original lTxid sequence order, independent of CP order. */
  readonly frames: readonly SourceFloatingTextbox[]
}

/** Original shape records and mutable field-use authority shared by anchor-specific readers. */
export interface TextShapeSource {
  /** Complete shape-local semantic values. */
  shape: TextShapeProperties
  /** Same source property compiler, before anchor-specific fields are consumed. */
  properties: OfficeArtEffectiveProperties
  /** Original direct records, without treating a child rectangle as an FSPA. */
  children: readonly OfficeArtRecord[]
}

/** Direct solid source paint, with no-fill represented by a null color. */
export interface TextboxPaint {
  /** Literal RGB value, or no fill. */
  color: string | null
  /** Exact original 16.16 opacity fraction. */
  opacity: number
}

/** Ordinary text-shape fields with their real physical owner; author content remains independent. */
export interface SourceFloatingTextbox {
  /** Original main/header textbox subdocument. */
  kind: 'textbox' | 'headerTextbox'
  /** Actual physical owner CP, shared with the real containing group for a child. */
  position: number
  /** Unique original shape identity. */
  shapeId: number
  /** Original Word text identifier, before one-based chain lookup. */
  textId: number
  /** Original unsigned next-shape operand; the Word text owner decides whether it is a single-frame self-reference. */
  nextShapeId: number
  /** Whether this is the dedicated textbox shape rather than a rectangle containing text. */
  textbox: boolean
  /** Positive physical creation dimensions resolved to EMU without rounding intermediate group frames. */
  extent: readonly [number, number]
  /** Exact placement of the actual standalone shape or enclosing anchored group. */
  placement: FloatingPicturePlacement
  /** Original rotation in 16.16 degrees. */
  rotation: number
  /** Independent source horizontal flip. */
  flipX: boolean
  /** Independent source vertical flip. */
  flipY: boolean
  /** Source aspect-ratio protection. */
  lockAspect: boolean
  /** Original left, top, right and bottom margins in EMU. */
  insets: readonly [number, number, number, number]
  /** Supported vertical text anchor. */
  verticalAlignment: 't' | 'ctr' | 'b'
  /** Whether ordinary text wraps at the inner frame. */
  wrapInside: boolean
  /** Whether the shape is permitted to fit its author text. */
  fitShape: boolean
  /** Effective direct solid fill. */
  fill: TextboxPaint
  /** Effective direct solid line paint. */
  stroke: TextboxPaint
  /** Original line width in EMU. */
  lineWidth: number
  /** Source fields outside this projection. */
  unprojected: readonly number[]
  /** Original uninterpreted record types. */
  unprojectedRecords: readonly number[]
  /** Whether unique FSPA ownership recovered an observed stale zero ClientAnchor. */
  staleClientAnchor: boolean
}

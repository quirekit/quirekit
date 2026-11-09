import type { SourcePictureFrame } from '../../pictures/types'
import type { DocDrawingAnchor, DocDrawingPart, DocDrawingShape } from '../types'
import type { PropertyOperation } from '../../properties/types'
import type { SourceFloatingTextbox, SourceTextboxChain } from '../textboxes/types'
import type { OfficeArtEffectiveProperties, OfficeArtRecord } from '../../office-art/types'
import type { SourceFloatingGroup } from '../groups/types'

/** Decoded ordinary media shape before its physical anchor or group placement is applied. */
export interface PictureShapeSource {
  /** @returns Complete source media after the caller validates actual placement. */
  load(): SourcePictureFrame
  /** Original global display-media slot. */
  mediaIndex: number
  /** Source property-use owner, still available for caller-specific placement. */
  properties: OfficeArtEffectiveProperties
  /** Original direct records, without synthesizing a source FSPA. */
  children: readonly OfficeArtRecord[]
}

/** One admitted source axis, keeping alignment and absolute offset mutually exclusive. */
export interface FloatingPictureAxis {
  /** Exact supported WordprocessingDrawing reference. */
  reference: string
  /** Supported physical alignment, or null for an offset. */
  alignment: string | null
  /** Original source distance already converted to EMU, used only for an offset. */
  offset: number
}

/** Complete basic placement tuple for a single ordinary picture occurrence. */
export interface FloatingPicturePlacement {
  /** Independent horizontal source placement. */
  horizontal: FloatingPictureAxis
  /** Independent vertical source placement. */
  vertical: FloatingPictureAxis
  /** Original effective source wrap intent, before any target codec approximation. */
  wrap: 'none' | 'square' | 'top-and-bottom' | 'tight' | 'through'
  /** Side used only by square wrapping. */
  side: string
  /** Left, top, right and bottom distances in EMU. */
  distances: readonly [number, number, number, number]
  /** Source paint side relative to paragraph text. */
  behind: boolean
  /** Whether the source anchor is locked to its paragraph. */
  locked: boolean
  /** Effective source cell participation. */
  layoutInCell: boolean
  /** Effective source overlap permission. */
  allowOverlap: boolean
  /** Original shape preorder rank, independent of CP order and generated drawing identity. */
  rank: number
}

/** Source scope and unique shape identity established before media or XML registration. */
export interface FloatingPictureIndex {
  /** Complete owning main/header part. */
  part: DocDrawingPart
  /** Raw CP/FSPA anchor. */
  anchor: DocDrawingAnchor
  /** Original slot used by ClientAnchor. */
  anchorIndex: number
  /** Same-part FSPAs naming this source shape; recovery requires exactly one. */
  anchorReferences: number
  /** Unique ordinary shape; null means missing or ambiguous identity. */
  shape: DocDrawingShape | null
  /** Unique owning root group, without a repeated linear scan during conversion. */
  parent: DocDrawingShape | null
  /** Physical shape rank, preserving original stacking independently of source CPs. */
  rank: number
}

/** Fully validated media and frame, with an independent global storage identity. */
export interface SourceFloatingPicture {
  /** Whether a well-formed stale zero ClientAnchor used its unique original FSPA association. */
  staleClientAnchor: boolean
  /** Original one-based source media-store index, distinct from inline Data offsets. */
  mediaIndex: number
  /** Exact decoded source bytes and occurrence-local crop/transform/metadata. */
  picture: SourcePictureFrame
  /** Complete basic original floating placement tuple. */
  placement: FloatingPicturePlacement
}

/** Document-owned lazy floating source and media reader. */
export interface FloatingPictureReader {
  /** @param position - Exact original CP. @returns Whether the immutable physical owner is a group. */
  isGroup(position: number): boolean
  /** @param position - Original group CP. @param special - Resolved character role. @param operations - Original character operations. @returns Whole validated group, without resource installation or author claims. */
  readGroup(position: number, special: boolean, operations: readonly PropertyOperation[]): SourceFloatingGroup
  /** @param position - Actual displayed source CP. @returns Whether the exact original shape declares text ownership. */
  isTextbox(position: number): boolean
  /** @param position - Actual source CP. @param special - Final source character role. @param operations - Original character operations. @returns Validated ordinary textbox frame and text identity. */
  readTextbox(position: number, special: boolean, operations: readonly PropertyOperation[]): SourceFloatingTextbox
  /** @param box - Original frame selected by its actual source CP. @returns Complete same-part source chain, or undefined for an unambiguous single frame. */
  readTextboxChain(box: SourceFloatingTextbox): SourceTextboxChain | undefined
  /** @param position - Exact source CP. @param special - Final resolved CFSpec flag. @param operations - Original character operations. @returns Fully validated ordinary floating picture. */
  read(position: number, special: boolean, operations: readonly PropertyOperation[]): SourceFloatingPicture
}

import type { SourcePictureFrame } from '../../pictures/types'
import type { DocDrawingShape } from '../types'
import type { SourceFloatingTextbox } from '../textboxes/types'
import type { FloatingPicturePlacement } from '../pictures/types'

/** Physical EMU frame relative to its actual parent group's rebased coordinate system. */
export interface DrawingGroupFrame {
  /** Left coordinate. */
  readonly x: number
  /** Top coordinate. */
  readonly y: number
  /** Positive physical width. */
  readonly width: number
  /** Positive physical height. */
  readonly height: number
}

/** Once-built same-part source identity and hierarchy index. */
export interface DrawingGroupIndex {
  /** Unique source occurrence by id; null records ambiguity. */
  readonly shapes: ReadonlyMap<number, DocDrawingShape | null>
  /** Original ordered direct children by real parent id. */
  readonly children: ReadonlyMap<number, readonly DocDrawingShape[]>
  /** Original FSPA reference counts, never fabricated for a child. */
  readonly anchors: ReadonlyMap<number, number>
}

/** Original text-capable leaf with its independently resolved physical frame. */
export interface SourceGroupTextbox {
  /** Text-capable ordinary shape discriminator. */
  readonly kind: 'textbox'
  /** Exact physical frame in its containing group. */
  readonly frame: DrawingGroupFrame
  /** Shape-local values and original text id; placement stays with the group root. */
  readonly box: SourceFloatingTextbox
}

/** Ordinary source picture within a group, without a fake physical anchor. */
export interface SourceGroupPicture {
  /** Media leaf discriminator. */
  readonly kind: 'picture'
  /** Original shape identity. */
  readonly shapeId: number
  /** Physical frame relative to the containing group. */
  readonly frame: DrawingGroupFrame
  /** Exact original global media slot. */
  readonly mediaIndex: number
  /** Complete original media, crop and leaf transform. */
  readonly picture: SourcePictureFrame
}

/** Recursively validated ordinary source group; no output resources have been installed. */
export interface SourceDrawingGroup {
  /** Group discriminator. */
  readonly kind: 'group'
  /** Original group shape id. */
  readonly shapeId: number
  /** Physical frame, with its children rebased to zero. */
  readonly frame: DrawingGroupFrame
  /** Complete ordered children, with no unsupported branch silently filtered. */
  readonly children: readonly SourceDrawingGroupNode[]
  /** Original group aspect protection; independent leaf protection stays on each leaf. */
  readonly lockAspect: boolean
  /** Uninterpreted source properties requiring explicit loss reporting. */
  readonly unprojected: readonly number[]
  /** Uninterpreted original record types. */
  readonly unprojectedRecords: readonly number[]
}

/** Closed ordinary group tree. */
export type SourceDrawingGroupNode = SourceDrawingGroup | SourceGroupTextbox | SourceGroupPicture

/** Unique physical group anchor and its fully validated original subtree. */
export interface SourceFloatingGroup {
  /** Actual source story family. */
  readonly kind: 'main' | 'header'
  /** Original displayed source character. */
  readonly position: number
  /** Complete original placement of the group. */
  readonly placement: FloatingPicturePlacement
  /** Whole prepared tree, not a partial leaf result. */
  readonly group: SourceDrawingGroup
  /** Whether a unique physical FSPA recovered a stale zero ClientAnchor. */
  readonly staleClientAnchor: boolean
}

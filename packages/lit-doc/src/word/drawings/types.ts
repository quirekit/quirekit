import type { OfficeArtProperty, OfficeArtReadContext, OfficeArtRecord } from '../office-art/types'

/** One original source property layer, without prematurely compiling defaults or boolean use bits. */
export interface DocDrawingPropertyTable {
  /** Physical property-table authority. */
  kind: 'primary' | 'secondary' | 'tertiary'
  /** Complete entries in their source order, including storage flags and complex bytes. */
  properties: readonly OfficeArtProperty[]
}

/** Shape occurrence in an OfficeArt drawing, independent of an FSPA anchor or media resource. */
export interface DocDrawingShape {
  /** Original unsigned shape identifier. */
  id: number
  /** Original twelve-bit shape type. */
  type: number
  /** Original unsigned shape flag word. */
  flags: number
  /** Parent group identity, or null at the drawing root. */
  parentId: number | null
  /** Original group coordinate rectangle, without normalizing axes. */
  groupBounds: readonly [number, number, number, number] | null
  /** Original child coordinate rectangle, without flattening the parent transform. */
  childBounds: readonly [number, number, number, number] | null
  /** Separate source property-table layers, including duplicates in physical order. */
  propertyTables: readonly DocDrawingPropertyTable[]
  /** Additional bounded records not interpreted as canonical drawing semantics. */
  unprojectedRecords: readonly number[]
}

/** A raw shape anchor in the common concatenated source CP space. */
export interface DocDrawingAnchor {
  /** Absolute source character position; does not imply an editable content range. */
  position: number
  /** Original unsigned shape identifier. */
  shapeId: number
  /** Left, top, right and bottom source twips, including negative or reversed rectangles. */
  bounds: readonly [number, number, number, number]
  /** Complete original sixteen-bit FSPA flag word. */
  flags: number
  /** Original unsigned textbox count or undefined source operand. */
  textboxCount: number
}

/** Complete source data for the main or aggregate header drawing part. */
export interface DocDrawingPart {
  /** Document part owning relative anchor CPs and its labelled OfficeArt drawing. */
  kind: 'main' | 'header'
  /** Physical labelled-drawing slot, or null when no container exists for this part. */
  sourceOrder: number | null
  /** Complete anchors in original position order. */
  anchors: readonly DocDrawingAnchor[]
  /** Original undefined terminal PLC operand, kept relative and never used as a content endpoint. */
  terminalCp: number | null
  /** Source shapes and nested groups in physical preorder. */
  shapes: readonly DocDrawingShape[]
  /** Other bounded records within the drawing/group containers. */
  unprojectedRecords: readonly number[]
}

/** Optional floating drawing source graph; not an OOXML preservation or editor model. */
export interface DocDrawingsSource {
  /** Declares source observation without native drawing-conversion admission. */
  scope: 'floating-drawing-source'
  /** Whether FIB 50 contains an OfficeArt group, independently of shape counts. */
  present: boolean
  /** Original drawing-group default property layers. */
  defaults: readonly DocDrawingPropertyTable[]
  /** Number of one-based source image-store slots; payload decoding is independent. */
  mediaCount: number
  /** Original store instance count, or null when the store is absent; may differ from physical slots. */
  mediaDeclaredCount: number | null
  /** Fixed main and header entries; sourceOrder retains physical label order. */
  parts: readonly DocDrawingPart[]
  /** Additional bounded records within the global drawing group. */
  unprojectedRecords: readonly number[]
}

/** Mutable work/allocation counters shared by both source drawing parts. */
export interface DrawingReadContext extends OfficeArtReadContext {
  /** Optional private physical-record index for admitted media consumers. */
  shapeRecords?: Map<DocDrawingShape, OfficeArtRecord>
  /** Shape records already allocated, including structural groups. */
  shapesRead: number
  /** Anchors already allocated across both parts. */
  anchorsRead: number
}

/** Private source and physical media authorities, never exposed as an editor or public inspection object. */
export interface DrawingSourceData {
  /** Publicly inspectable original source graph. */
  source: DocDrawingsSource
  /** Complete one-based image-store records, without eager media expansion. */
  media: readonly OfficeArtRecord[]
  /** Exact source records keyed by occurrence object, preserving ambiguous raw ids for later rejection. */
  shapeRecords: ReadonlyMap<DocDrawingShape, OfficeArtRecord>
}

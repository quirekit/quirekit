import type { OfficeArtProperty, OfficeArtReadContext } from '../office-art/types'

/** Source geometry and metadata of a picture occurrence. */
export interface SourcePictureFrame {
  /** Portable original media file. */
  bytes: Uint8Array
  /** Media MIME type. */
  mime: string
  /** Initial width in source twips. */
  initialWidth: number
  /** Initial height in source twips. */
  initialHeight: number
  /** Horizontal scale in tenths of a percent. */
  scaleX: number
  /** Vertical scale in tenths of a percent. */
  scaleY: number
  /** Source left, top, right and bottom crop fractions as signed 16.16 integers. */
  crop: readonly [number, number, number, number]
  /** Source rotation as signed 16.16 degrees. */
  rotation: number
  /** Source horizontal flip. */
  flipX: boolean
  /** Source vertical flip. */
  flipY: boolean
  /** Aspect lock after local use-bit writes and the source default. */
  lockAspect: boolean
  /** Source drawing name. */
  name: string | null
  /** Source alternative text. */
  description: string | null
  /** Source properties requiring later interpretation. */
  unprojected: readonly number[]
  /** Container records whose additional semantics remain outside projection. */
  unprojectedRecords: readonly number[]
  /** Source picture borders requiring projection. */
  hasBorders: boolean
}

/** One Data-stream inline picture and its original locator identity. */
export interface SourcePicture extends SourcePictureFrame {
  /** Original Data-stream byte offset, distinct from a global floating image-store index. */
  offset: number
}

/** Per-document source budget and immutable byte authorities. */
export interface PictureReadContext extends OfficeArtReadContext {
  /** Optional Data stream containing inline pictures. */
  data: Uint8Array | undefined
  /** WordDocument stream owning delay references. */
  word: Uint8Array
  /** Aggregate decoded bytes charged before payload allocation. */
  decodedBytes: number
}

/** Direct character-owned object locator and role flags. */
export interface PictureReference {
  /** Data-stream offset when explicitly supplied. */
  offset: number | null
  /** Source character contains binary field data. */
  binary: boolean
  /** Source character is an object preview. */
  object: boolean
  /** Source character references an OLE storage. */
  ole: boolean
}

/** Validated source shape properties and their associated file blocks. */
export interface PictureShape {
  /** Shape flags including horizontal/vertical flips. */
  flags: number
  /** Ordered primary and tertiary property writes. */
  properties: readonly OfficeArtProperty[]
  /** Corresponding inline BLIP property identifiers in encounter order. */
  blipRoles: readonly number[]
  /** Additional container records requiring diagnostics. */
  unprojectedRecords: readonly number[]
}

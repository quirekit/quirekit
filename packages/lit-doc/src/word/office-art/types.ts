import type { DocReadErrorCode, DocReadLimits } from '../../types'
import type { PropertyReader } from '../properties/types'

/** One bounded source OfficeArt record, without assuming inline or floating ownership. */
export interface OfficeArtRecord {
  /** Original storage record type. */
  type: number
  /** Version nibble. */
  version: number
  /** Original twelve-bit instance or shape type. */
  instance: number
  /** Exact payload, bounded by the enclosing record. */
  data: Uint8Array
  /** First byte following this record in the caller's coordinate space. */
  end: number
}

/** Raw property identity, preserving the distinction between a scalar and complex bytes. */
export interface OfficeArtProperty {
  /** Original property number, without the two storage flags. */
  id: number
  /** Complete original property word, including fBid and fComplex. */
  flags: number
  /** Original unsigned operand or declared complex byte length. */
  value: number
  /** Complete physical complex data, including any separately counted array header. */
  complex?: Uint8Array
}

/** Shared bounded work and allocation policy for OfficeArt source reads. */
export interface OfficeArtReadContext {
  /** Validated source limits. */
  limits: DocReadLimits
  /** Record and property work charged across the complete source pass. */
  reader: PropertyReader
  /** Failure category belonging to the source feature that requested this pass. */
  errorCode: DocReadErrorCode
  /** Allocation authority shared by every complex property in the source pass. */
  propertyBytes: {
    /** Remaining complex bytes, charged before copying. */
    remaining: number
  }
}

/** Compiled property access that keeps raw layers intact and tracks partially interpreted boolean fields. */
export interface OfficeArtEffectiveProperties {
  /** @param id - Original property number. @returns Last physical property or absence. */
  property(id: number): OfficeArtProperty | undefined
  /** @param id - Signed scalar property. @param fallback - Format default. @returns Effective signed value. */
  scalar(id: number, fallback: number): number
  /** @param id - Boolean property group. @param bit - Low-half value bit. @param fallback - Format default. @returns Effective value after independent use-bit writes. */
  flag(id: number, bit: number, fallback: boolean): boolean
  /** @returns Source fields or active boolean bits whose semantics were not consumed. */
  unprojected(): number[]
}

import type { SourcePackageLimits, SourcePackagePart, SourcePackageRelationship } from '../source-package/types.js'

/** Source relationship used by the chart preservation contract. */
export type ChartSourceRelationship = SourcePackageRelationship
/** Reachable opaque part used by the chart preservation contract. */
export type ChartSourcePart = SourcePackagePart

/** One immutable drawing referring to shared source parts. */
export interface ChartSourceEntry {
  /** Registry-local immutable source identity. */
  readonly id: string
  /** Story part owning this drawing's relationships. */
  readonly sourcePart: string
  /** Original preserve-order drawing XML, excluding separately captured inherited namespaces. */
  readonly drawingXml: string
  /** Namespace declarations inherited at this source drawing. */
  readonly namespaces: Readonly<Record<string, string>>
  /** Relationships actually referenced by this drawing. */
  readonly relationships: readonly ChartSourceRelationship[]
}

/** JSON-safe source graph carried independently from chart nodes. */
export interface ChartSourceRegistry {
  /** Source graph protocol version. */
  readonly version: 1
  /** Drawing entries retained for document history. */
  readonly entries: readonly ChartSourceEntry[]
  /** Shared immutable dependency bytes, deduplicated by absolute name. */
  readonly parts: readonly ChartSourcePart[]
}

/** Caller-configurable bounds checked before accepting a source graph. */
export type ChartSourceLimits = SourcePackageLimits

/** Derived display fields that never replace original drawing authority. */
export interface ChartSourceDisplay {
  /** Width in CSS pixels projected from the original extent. */
  readonly width: number
  /** Height in CSS pixels projected from the original extent. */
  readonly height: number
  /** Original alternative description or display name. */
  readonly alt: string
}

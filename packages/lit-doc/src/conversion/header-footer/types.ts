import type { DocxPackagePartPlan, DocxRelationshipPlan, DocxResourcePlan, DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocReadError } from '../../errors'
import type { DocHeaderFooterSource } from '../../word/header-footer/types'
import type { ConversionSource } from '../source/types'

/** Optional header subdocument with source directory and a single canonical content pass. */
export interface HeaderFooterInput {
  /** Complete source slots, absent after an explicitly diagnosed directory refusal. */
  directory: DocHeaderFooterSource | null
  /** Shared header aggregate arrays, absent when empty or interpretation was refused. */
  content: ConversionSource | null
  /** Known per-story topology refusals keyed by original nonempty story start. */
  refusals: ReadonlyMap<number, DocReadError>
}

/** Complete successful story parts and their independently owned relationships. */
export interface HeaderFooterProjection {
  /** Header/footer XML parts. */
  parts: DocxPackagePartPlan[]
  /** Relationships owned by the main document and each successful story. */
  relationships: DocxRelationshipPlan[]
  /** Successful story media, deduplicated together with main-document resources by the caller. */
  resources: DocxResourcePlan[]
  /** Ordered references to prepend to each main-body section's properties. */
  references: ReadonlyMap<number, readonly DocxXmlElementPlan[]>
}

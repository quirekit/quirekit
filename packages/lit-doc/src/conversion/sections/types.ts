import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'

/** Main-story section interval and its independently located page properties. */
export interface ProjectedSection {
  /** Inclusive main-story CP. */
  start: number
  /** Exclusive main-story CP, clamped only at the final global terminator. */
  end: number
  /** Typed section properties; attached to paragraph end or final body position. */
  properties: DocxXmlElementPlan
}

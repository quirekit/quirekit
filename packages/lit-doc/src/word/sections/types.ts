import type { PropertyOperation } from '../properties/types'

/** One independently located section and its ordered source properties. */
export interface WordSectionRecord {
  /** Inclusive main-story CP. */
  start: number
  /** Exclusive main-story CP, excluding a final global guard. */
  end: number
  /** Original ordered SEPX operations. */
  operations: readonly PropertyOperation[]
}

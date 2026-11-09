import type { CompoundFile } from '../../compound/types'
import type { DocReadLimits } from '../../types'
import type { WordHeader, WordTextStorage } from '../types'

/** Shared bounded storage authorities for inspection and semantic projection. */
export interface WordDocumentSource {
  /** Container retaining lazy stream access. */
  container: CompoundFile
  /** Original WordDocument bytes. */
  word: Uint8Array
  /** FIB-selected Table bytes. */
  table: Uint8Array
  /** Validated FIB locators and story extents. */
  header: WordHeader
  /** Original code units, pieces and their source modifiers. */
  storage: WordTextStorage
  /** Resolved resource policy for this input snapshot. */
  limits: DocReadLimits
}

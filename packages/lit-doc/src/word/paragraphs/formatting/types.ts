import type { DocParagraphBaseFormat } from '../../../types'
import type { ParagraphNumberingState } from '../../numbering/types'

/** Cached style properties compiled together under the shared operation budget. */
export interface ParagraphStyleValue {
  /** Immutable base settings, before direct overrides. */
  format: DocParagraphBaseFormat
  /** Total ancestor-chain depth. */
  depth: number
  /** Optional raw numbering state compiled during the same property traversal. */
  numbering?: ParagraphNumberingState
}

/** Semantic paragraph fields whose explicit presence survives equal inherited defaults. */
export type ParagraphPropertyKey = Exclude<keyof DocParagraphBaseFormat, 'scope' | 'styleIndex' | 'unsupportedOpcodes'>

/** Canonical source paragraph-style inheritance resolver. */
export interface ParagraphStyleResolver {
  /**
   * Compiles and caches one source style without direct paragraph overrides.
   * @param index - Source paragraph style slot.
   * @returns Immutable inherited paragraph base properties.
   */
  resolve(index: number): DocParagraphBaseFormat
  /**
   * Reads captured references without interpreting the style properties again.
   * @param index - Source paragraph style slot.
   * @returns Immutable cached reference state, or undefined when capture was not requested.
   */
  resolveNumbering(index: number): ParagraphNumberingState | undefined
}

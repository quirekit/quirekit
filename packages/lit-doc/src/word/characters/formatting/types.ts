import type { CharacterToggleField, DocCharacterBaseFormat } from '../types'

/** Immutable default comparison values and optional lazy source font identity. */
export interface CharacterMajorityContext {
  /** Source document defaults, without paragraph or direct inheritance. */
  defaults: DocCharacterBaseFormat
  /** @param index - Original font-table index. @returns Declared primary font name, without installed-font substitution. */
  fontName?: ((index: number) => string) | undefined
}

/** Semantic fields written by a direct layer, independent of equality to inherited values. */
export type CharacterPropertyKey = Exclude<keyof DocCharacterBaseFormat,
  'scope' | 'paragraphStyleIndex' | 'characterStyleIndex' | 'fontIndexes' | 'unsupportedOpcodes'>
  | `font:${keyof DocCharacterBaseFormat['fontIndexes']}`

/** Exact last surviving source toggle operation per semantic field. */
export type CharacterToggleModes = Map<CharacterToggleField, 0 | 1 | 0x80 | 0x81>

/** Source style compiler with independent paragraph and character inheritance. */
export interface CharacterStyleResolver {
  /**
   * Compiles text properties from a paragraph style chain.
   * @param index - Source paragraph style slot.
   * @returns Immutable cached paragraph text settings.
   */
  paragraph(index: number): DocCharacterBaseFormat
  /**
   * Applies a character style chain over the paragraph baseline.
   * @param paragraph - Immutable underlying paragraph text settings.
   * @param index - Source character style slot.
   * @returns Immutable cached character style settings.
   */
  character(paragraph: DocCharacterBaseFormat, index: number): DocCharacterBaseFormat
}

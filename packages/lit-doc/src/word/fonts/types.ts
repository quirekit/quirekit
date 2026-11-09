/** Original FFN metadata, kept independent of font selection and installed font files. */
export interface WordFontRecord {
  /** Primary source family name. */
  name: string
  /** Optional alternate source family name. */
  alternateName?: string
  /** Extra zero UTF-16 code units after the final terminated name, when present. */
  namePadding?: number
  /** Default, fixed or variable source pitch. */
  pitch: 0 | 1 | 2
  /** Unspecified, roman, swiss, modern, script or decorative source family. */
  family: number
  /** Whether the source identifies this as a TrueType face. */
  trueType: boolean
  /** Original weight from zero through one thousand. */
  weight: number
  /** Original Windows character-set byte, not a body text decoder choice. */
  charset: number
  /** Ten source PANOSE classification bytes. */
  panose: readonly number[]
  /** Four Unicode-subset and two code-page bitfields, in source order. */
  signature: readonly number[]
}

import type { PhysicalPropertyRecord } from '../properties/types'
import type { WordFontDefaults } from '../styles/types'

/** Source text color retaining palette identity or exact COLORREF bytes. */
export interface DocCharacterColor {
  /** Format used by the last color operation. */
  encoding: 'palette' | 'colorref'
  /** Palette index or unsigned COLORREF, respectively. */
  value: number
}

/** Derived character settings before list/table styles, script selection and final layout. */
export interface DocCharacterBaseFormat {
  /** Explicitly limits the interpretation to base character settings. */
  scope: 'character-base'
  /** Source paragraph style owning the underlying text properties. */
  paragraphStyleIndex: number
  /** Current source character style, with ten denoting the default character style. */
  characterStyleIndex: number
  /** Whether ordinary text is bold. */
  bold: boolean
  /** Whether ordinary text is italic. */
  italic: boolean
  /** Single strikethrough setting. */
  strike: boolean
  /** Double strikethrough setting. */
  doubleStrike: boolean
  /** Outline glyph setting. */
  outline: boolean
  /** Shadow glyph setting. */
  shadow: boolean
  /** Small-capital display setting. */
  smallCaps: boolean
  /** All-capital display setting. */
  caps: boolean
  /** Hidden text setting, without removing source positions. */
  hidden: boolean
  /** Emboss effect setting. */
  emboss: boolean
  /** Imprint effect setting. */
  imprint: boolean
  /** Complex-script bold setting. */
  boldComplex: boolean
  /** Complex-script italic setting. */
  italicComplex: boolean
  /** Whether proofing is disabled for the source text. */
  noProof: boolean
  /** Explicit right-to-left setting, or null for automatic language-based selection. */
  rightToLeft: boolean | null
  /** Explicit complex-script selection, or null for automatic script classification. */
  complexScript: boolean | null
  /** Source marks this text as a special control/object character. */
  special: boolean
  /** Source inserted-revision flag, without interpreting a revision object. */
  inserted: boolean
  /** Source deleted-revision flag, without interpreting a revision object. */
  deleted: boolean
  /** Hidden field-text setting. */
  fieldHidden: boolean
  /** Hidden-in-web-layout setting. */
  webHidden: boolean
  /** Four font-table indexes before resolving names or choosing a script slot. */
  fontIndexes: WordFontDefaults
  /** Ordinary font size in half-points, including a diagnosed legacy explicit zero. */
  fontSizeHalfPoints: number
  /** Explicit complex-script size in half-points, or null for script-dependent defaults. */
  fontSizeComplexHalfPoints: number | null
  /** MS-DOC Kul underline code. */
  underline: number
  /** Source foreground color, including automatic color and palette identity. */
  color: DocCharacterColor
  /** Optional complex-script palette color; null leaves it automatic. */
  colorComplex: number | null
  /** Underline COLORREF value. */
  underlineColorRef: number
  /** Ico highlight palette index, with zero denoting no highlight. */
  highlight: number
  /** Normal, superscript or subscript code, respectively zero, one or two. */
  verticalAlign: number
  /** Extra character spacing in signed twips. */
  spacingTwips: number
  /** Vertical position in signed half-points. */
  positionHalfPoints: number
  /** Horizontal character scaling percentage. */
  scalePercent: number
  /** Half-point threshold for kerning; zero disables it. */
  kerningHalfPoints: number
  /** MS-DOC East Asian emphasis code. */
  emphasis: number
  /** Latin/other LCID, with zero denoting undefined. */
  language: number
  /** East Asian LCID. */
  languageEastAsia: number
  /** Complex-script LCID. */
  languageComplex: number
  /** Script/font selection hint; 255 gives no guidance. */
  scriptHint: number
  /** Sorted unhandled source operations, retained across resets as a loss diagnostic. */
  unsupportedOpcodes: readonly number[]
}

/** Source text interval with explicitly scoped, derived base character settings. */
export interface DocCharacterRun {
  /** Inclusive logical UTF-16 position. */
  start: number
  /** Exclusive logical UTF-16 position, including any source controls in the range. */
  end: number
  /** Derived settings; not persistent editor marks. */
  baseFormat: DocCharacterBaseFormat
}

/** Internal logical intersection retaining its property and paragraph authorities. */
export interface CharacterSourceRecord {
  /** Inclusive source CP. */
  start: number
  /** Exclusive source CP. */
  end: number
  /** Owning logical paragraph index. */
  paragraphIndex: number
  /** Owning logical text-piece index. */
  pieceIndex: number
  /** Original physical CHPX record. */
  formatting: PhysicalPropertyRecord
  /** Original piece modifier. */
  propertyModifier: number
}

/** Boolean and automatic character fields accepted by ToggleOperand. */
export type CharacterToggleField = 'bold' | 'italic' | 'strike' | 'doubleStrike' | 'outline' | 'shadow' | 'smallCaps'
  | 'caps' | 'hidden' | 'emboss' | 'imprint' | 'boldComplex' | 'italicComplex' | 'noProof' | 'rightToLeft'
  | 'complexScript' | 'special' | 'inserted' | 'deleted' | 'fieldHidden' | 'webHidden'

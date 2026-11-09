import type { WordFontDefaults } from '../../styles/types'
import type { DocCharacterBaseFormat } from '../types'

/**
 * Creates the coherent binary-format default tuple without choosing a font or script.
 * @param paragraphStyleIndex - Owning paragraph style.
 * @param fonts - Source default font slots.
 * @returns Fresh independent base character settings.
 */
export function defaultCharacterFormat(paragraphStyleIndex: number, fonts: WordFontDefaults): DocCharacterBaseFormat {
  return { scope: 'character-base', paragraphStyleIndex, characterStyleIndex: 10,
    bold: false, italic: false, strike: false, doubleStrike: false, outline: false, shadow: false,
    smallCaps: false, caps: false, hidden: false, emboss: false, imprint: false, boldComplex: false,
    italicComplex: false, noProof: false, rightToLeft: null, complexScript: null,
    special: false, inserted: false, deleted: false, fieldHidden: false, webHidden: false,
    fontIndexes: { ...fonts }, fontSizeHalfPoints: 20, fontSizeComplexHalfPoints: null,
    underline: 0, color: { encoding: 'colorref', value: 0xff000000 }, colorComplex: null,
    underlineColorRef: 0xff000000, highlight: 0, verticalAlign: 0, spacingTwips: 0,
    positionHalfPoints: 0, scalePercent: 100, kerningHalfPoints: 0, emphasis: 0,
    language: 0, languageEastAsia: 0, languageComplex: 0, scriptHint: 0, unsupportedOpcodes: [] }
}

/**
 * Copies derived settings before any style or direct layer may modify them.
 * @param format - Cached or prior character settings.
 * @returns Independent settings and nested values.
 */
export function copyCharacterFormat(format: DocCharacterBaseFormat): DocCharacterBaseFormat {
  return { ...format, fontIndexes: { ...format.fontIndexes }, color: { ...format.color }, unsupportedOpcodes: [...format.unsupportedOpcodes] }
}

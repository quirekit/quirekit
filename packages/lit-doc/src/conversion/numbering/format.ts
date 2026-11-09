import { requireDoc } from '../../errors'

// MSONFC is shared by note numbering and lists. DOC list levels reserve four
// otherwise valid note formats; the caller's domain keeps that restriction.
const formats = [
  'decimal', 'upperRoman', 'lowerRoman', 'upperLetter', 'lowerLetter', 'ordinal', 'cardinalText', 'ordinalText', 'hex', 'chicago',
  'ideographDigital', 'japaneseCounting', 'aiueo', 'iroha', 'decimalFullWidth', 'decimalHalfWidth', 'japaneseLegal', 'japaneseDigitalTenThousand', 'decimalEnclosedCircle', 'decimalFullWidth2',
  'aiueoFullWidth', 'irohaFullWidth', 'decimalZero', 'bullet', 'ganada', 'chosung', 'decimalEnclosedFullstop', 'decimalEnclosedParen', 'decimalEnclosedCircleChinese', 'ideographEnclosedCircle',
  'ideographTraditional', 'ideographZodiac', 'ideographZodiacTraditional', 'taiwaneseCounting', 'ideographLegalTraditional', 'taiwaneseCountingThousand', 'taiwaneseDigital', 'chineseCounting', 'chineseLegalSimplified', 'chineseCountingThousand',
  'decimal', 'koreanDigital', 'koreanCounting', 'koreanLegal', 'koreanDigital2', 'hebrew1', 'arabicAlpha', 'hebrew2', 'arabicAbjad', 'hindiVowels',
  'hindiConsonants', 'hindiNumbers', 'hindiCounting', 'thaiLetters', 'thaiNumbers', 'thaiCounting', 'vietnameseCounting', 'numberInDash', 'russianLower', 'russianUpper',
] as const

/**
 * Maps an admitted source code to its OOXML spelling without choosing a marker renderer.
 * @param code - Original MSONFC value.
 * @param domain - Source domain, retaining DOC list-level restrictions by default.
 * @returns Exact standard value, including none and the decimal alias.
 */
export function numberingFormat(code: number, domain: 'list' | 'note' = 'list'): string {
  requireDoc(domain !== 'list' || ![8, 9, 15, 19].includes(code), 'unsupported-numbering', `Numbering format ${code} is reserved for DOC list levels`)
  if (code === 255) return 'none'
  const format = formats[code]
  requireDoc(format, 'unsupported-numbering', `Numbering format ${code} has no admitted OOXML mapping`)
  return format
}

export { palette, colorValue, colorRefValue } from '../../word/characters/formatting/color'
/** Exact Kul to ST_Underline correspondence. */
export const underlines: ReadonlyMap<number, string> = new Map([
  [0, 'none'], [1, 'single'], [2, 'words'], [3, 'double'], [4, 'dotted'], [6, 'thick'], [7, 'dash'],
  [9, 'dotDash'], [10, 'dotDotDash'], [11, 'wave'], [20, 'dottedHeavy'], [23, 'dashedHeavy'],
  [25, 'dashDotHeavy'], [26, 'dashDotDotHeavy'], [27, 'wavyHeavy'], [39, 'dashLong'], [43, 'wavyDouble'], [55, 'dashLongHeavy'],
])
/** Explicitly admitted LCID values from Microsoft's language identifier registry. */
export const languages: ReadonlyMap<number, string> = new Map([
  [0x0401, 'ar-SA'], [0x0402, 'bg-BG'], [0x0403, 'ca-ES'], [0x0404, 'zh-TW'], [0x0405, 'cs-CZ'],
  [0x0406, 'da-DK'], [0x0407, 'de-DE'], [0x0408, 'el-GR'], [0x0409, 'en-US'], [0x040a, 'es-ES'],
  [0x040b, 'fi-FI'], [0x040c, 'fr-FR'], [0x040d, 'he-IL'], [0x040e, 'hu-HU'], [0x040f, 'is-IS'],
  [0x0410, 'it-IT'], [0x0411, 'ja-JP'], [0x0412, 'ko-KR'], [0x0413, 'nl-NL'], [0x0414, 'nb-NO'],
  [0x0415, 'pl-PL'], [0x0416, 'pt-BR'], [0x0418, 'ro-RO'], [0x0419, 'ru-RU'], [0x041a, 'hr-HR'],
  [0x041b, 'sk-SK'], [0x041c, 'sq-AL'], [0x041d, 'sv-SE'], [0x041e, 'th-TH'], [0x041f, 'tr-TR'],
  [0x0420, 'ur-PK'], [0x0421, 'id-ID'], [0x0422, 'uk-UA'], [0x0423, 'be-BY'], [0x0424, 'sl-SI'],
  [0x0425, 'et-EE'], [0x0426, 'lv-LV'], [0x0427, 'lt-LT'], [0x0429, 'fa-IR'], [0x042a, 'vi-VN'],
  [0x0439, 'hi-IN'], [0x0801, 'ar-IQ'], [0x0804, 'zh-CN'], [0x0807, 'de-CH'], [0x0809, 'en-GB'],
  [0x080a, 'es-MX'], [0x080c, 'fr-BE'], [0x0810, 'it-CH'], [0x0816, 'pt-PT'], [0x0c04, 'zh-HK'],
  [0x0c09, 'en-AU'], [0x0c0a, 'es-ES'], [0x0c0c, 'fr-CA'], [0x1004, 'zh-SG'], [0x1009, 'en-CA'], [0x1404, 'zh-MO'],
])

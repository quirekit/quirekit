import type { WordNumberingCounterFormat, WordNumberingCounterFormatOptions } from "../../types";
import { formatCustomCounter } from "./custom";
import { formatNumericOrdinal } from "./ordinal";
import { resolveWordTextLanguage } from "./text-language";
import { formatWordZeroText } from "./text-language/zero";

/**
 * Handles zero before one-based glyph cycles and positive-number grammar run.
 *
 * @param format - Canonical non-bullet numbering format.
 * @param options - Marker language and exact custom expression.
 * @returns Numeric part only; the caller retains the template's punctuation.
 */
export function formatWordZeroCounter(
  format: WordNumberingCounterFormat,
  options: WordNumberingCounterFormatOptions
): string {
  switch (format) {
    case "arabicAbjad":
    case "arabicAlpha":
    case "chicago":
    case "hebrew1":
    case "hebrew2":
    case "hindiConsonants":
    case "hindiVowels":
    case "lowerLetter":
    case "lowerRoman":
    case "russianLower":
    case "russianUpper":
    case "thaiLetters":
    case "upperLetter":
    case "upperRoman":
    case "none":
      return "";
    case "decimalZero":
      return "00";
    case "decimalFullWidth":
    case "decimalFullWidth2":
      return "０";
    case "chineseCounting":
    case "chineseCountingThousand":
    case "taiwaneseCounting":
    case "taiwaneseDigital":
      return "○";
    case "chineseLegalSimplified":
    case "ideographLegalTraditional":
    case "koreanDigital2":
    case "taiwaneseCountingThousand":
      return "零";
    case "ideographDigital":
    case "japaneseCounting":
    case "japaneseDigitalTenThousand":
    case "japaneseLegal":
      return "〇";
    case "koreanCounting":
    case "koreanDigital":
      return "영";
    case "hindiCounting":
      return "शून्य";
    case "hindiNumbers":
      return "०";
    case "thaiCounting":
      return "ศูนย์";
    case "thaiNumbers":
      return "๐";
    case "vietnameseCounting":
      return "không";
    case "numberInDash":
      return "- 0 -";
    case "custom":
      return formatCustomCounter(0, options.customFormat);
    case "cardinalText":
    case "ordinalText":
      return formatWordZeroText(format, resolveWordTextLanguage(options.language));
    case "ordinal": {
      const language = resolveWordTextLanguage(options.language);
      return language === "fr-FR" ? "0" : formatNumericOrdinal(0, language);
    }
    default:
      return "0";
  }
}

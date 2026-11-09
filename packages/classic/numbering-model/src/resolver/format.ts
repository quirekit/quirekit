import type {
  WordNumberingCounterFormat,
  WordNumberingCounterFormatOptions
} from "../types";
import {
  formatChineseCounting,
  formatChineseCountingThousand,
  formatChineseLegalSimplified,
  formatIdeographZodiac,
  formatJapaneseCounting
} from "./east-asian";
import { formatCjkCounter } from "./formats/cjk";
import {
  formatHindiCounting,
  formatThaiCounting,
  formatVietnameseCounting
} from "./formats/counting-words";
import { formatCustomCounter } from "./formats/custom";
import { formatScriptDigits } from "./formats/digits";
import { formatNumericOrdinal } from "./formats/ordinal";
import { formatSequenceCounter } from "./formats/sequences";
import {
  formatWordCardinalText,
  formatWordOrdinalText,
  resolveWordTextLanguage
} from "./formats/text-language";
import { formatDeterministicWordNumberingCounter } from "./deterministic";
import { formatWordZeroCounter } from "./formats/zero";

const letterCycleLength = 780;
const romanCycleLength = 32_767;
const romanTokens = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"]
] as const;

/**
 * Formats one validated Word numbering counter without mutating sequence state.
 *
 * @param format - Canonical non-bullet numbering format.
 * @param value - Non-negative integer counter value.
 * @param options - Marker language and custom expression context.
 * @returns Visible counter text for marker-template expansion.
 */
export function formatWordNumberingCounter(
  format: WordNumberingCounterFormat,
  value: number,
  options: WordNumberingCounterFormatOptions = {}
): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError("Word numbering counters must be non-negative integers.");
  }
  if (value === 0) return formatWordZeroCounter(format, options);
  switch (format) {
    case "decimal":
      return String(value);
    case "decimalZero":
      return value < 10 ? `0${value}` : String(value);
    case "aiueo":
    case "aiueoFullWidth":
    case "arabicAbjad":
    case "arabicAlpha":
    case "chicago":
    case "chosung":
    case "ganada":
    case "hebrew1":
    case "hebrew2":
    case "hindiConsonants":
    case "hindiVowels":
    case "iroha":
    case "irohaFullWidth":
    case "russianLower":
    case "russianUpper":
    case "thaiLetters":
      return formatSequenceCounter(format, value);
    case "hindiNumbers":
    case "ideographDigital":
    case "japaneseDigitalTenThousand":
    case "koreanDigital":
    case "koreanDigital2":
    case "taiwaneseDigital":
    case "thaiNumbers":
      return formatScriptDigits(format, value);
    case "ideographLegalTraditional":
    case "japaneseLegal":
    case "koreanCounting":
    case "koreanLegal":
    case "taiwaneseCounting":
    case "taiwaneseCountingThousand":
      return formatCjkCounter(format, value);
    case "hindiCounting":
      return formatHindiCounting(value);
    case "thaiCounting":
      return formatThaiCounting(value);
    case "vietnameseCounting":
      return formatVietnameseCounting(value);
    case "cardinalText":
      return formatWordCardinalText(
        value,
        resolveWordTextLanguage(options.language)
      );
    case "ordinalText":
      return formatWordOrdinalText(
        value,
        resolveWordTextLanguage(options.language)
      );
    case "ordinal":
      return formatNumericOrdinal(
        value,
        resolveWordTextLanguage(options.language)
      );
    case "custom":
      return formatCustomCounter(value, options.customFormat);
    case "bahtText":
    case "dollarText":
      return String(value);
    case "decimalEnclosedCircle":
    case "decimalEnclosedFullstop":
    case "decimalEnclosedParen":
    case "decimalFullWidth":
    case "decimalFullWidth2":
    case "decimalHalfWidth":
    case "hex":
    case "ideographEnclosedCircle":
    case "ideographTraditional":
    case "ideographZodiacTraditional":
    case "numberInDash":
    case "none":
      return formatDeterministicWordNumberingCounter(format, value);
    case "upperRoman":
      return formatRoman(normalizeCycle(value, romanCycleLength));
    case "lowerRoman":
      return formatRoman(normalizeCycle(value, romanCycleLength)).toLowerCase();
    case "upperLetter":
      return formatRepeatedLetter(normalizeCycle(value, letterCycleLength), 65);
    case "lowerLetter":
      return formatRepeatedLetter(normalizeCycle(value, letterCycleLength), 97);
    case "decimalEnclosedCircleChinese":
      return value <= 10
        ? String.fromCodePoint(0x2460 + value - 1)
        : String(value);
    case "chineseCounting":
      return formatChineseCounting(value);
    case "chineseCountingThousand":
      return formatChineseCountingThousand(value);
    case "chineseLegalSimplified":
      return formatChineseLegalSimplified(value);
    case "japaneseCounting":
      return formatJapaneseCounting(value);
    case "ideographZodiac":
      return formatIdeographZodiac(value);
  }
}

/**
 * Keeps mature-runtime numbering within one finite visible cycle.
 *
 * @param value - Positive counter value.
 * @param cycleLength - Last value in the visible cycle.
 * @returns One-based counter inside the cycle.
 */
function normalizeCycle(value: number, cycleLength: number): number {
  return ((value - 1) % cycleLength) + 1;
}

/**
 * Formats the Word outline alphabet sequence `A..Z, AA..ZZ, AAA..`.
 *
 * @param value - One-based value inside the finite letter cycle.
 * @param alphabetStart - Unicode code point for uppercase or lowercase A.
 * @returns One repeated Latin letter.
 */
function formatRepeatedLetter(value: number, alphabetStart: number): string {
  const zeroBased = value - 1;
  const character = String.fromCodePoint(alphabetStart + (zeroBased % 26));
  return character.repeat(Math.floor(zeroBased / 26) + 1);
}

/**
 * Formats one positive integer with subtractive Roman tokens.
 *
 * @param value - Positive value inside the finite Roman cycle.
 * @returns Uppercase Roman representation.
 */
function formatRoman(value: number): string {
  let remaining = value;
  let result = "";
  for (const [tokenValue, token] of romanTokens) {
    while (remaining >= tokenValue) {
      result += token;
      remaining -= tokenValue;
    }
  }
  return result;
}

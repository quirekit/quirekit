/**
 * Formats one numeric ordinal using the effective marker language.
 *
 * @param value - Non-negative counter, with the French zero handled by the caller.
 * @param language - Effective BCP 47 marker language.
 * @returns Language-specific numeric ordinal.
 */
export function formatNumericOrdinal(
  value: number,
  language: string | undefined
): string {
  switch (language) {
    case "de-DE":
    case "eu-ES":
    case "tr-TR":
    case "sr-Cyrl-RS":
    case "sr-Latn-RS":
    case "pl-PL":
    case "cs-CZ":
      return `${value}.`;
    case "el-GR":
      return `${value}ο`;
    case "fr-FR":
      return `${value}${value === 1 ? "er" : "e"}`;
    case "it-IT":
      return `${value}°`;
    case "nl-NL":
      return `${value}e`;
    case "pt-PT":
    case "es-ES":
    case "pt-BR":
      return `${value}º`;
    case "ru-RU":
      return `${value}-й`;
    case "sv-SE":
      return `${value}${
        value !== 11 && value !== 12 && (value % 10 === 1 || value % 10 === 2)
          ? ":a"
          : ":e"
      }`;
    default:
      return formatEnglishNumericOrdinal(value);
  }
}

/**
 * Formats one English numeric ordinal.
 *
 * @param value - Positive counter.
 * @returns English number plus ordinal suffix.
 */
function formatEnglishNumericOrdinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

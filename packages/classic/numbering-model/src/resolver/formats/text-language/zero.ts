const words: Readonly<Record<string, readonly [string, string]>> = {
  "bg-BG": ["Нула", "Нулевят"],
  "cs-CZ": ["Nula", "Nultý"],
  "de-DE": ["Null", "Nullte"],
  "el-GR": ["Μηδέν", "Μηδενικό"],
  "es-ES": ["Cero", "Cero"],
  "eu-ES": ["Zero", "Zerogarren"],
  "fr-FR": ["Zéro", "Zéro"],
  "it-IT": ["Zero", "Zero"],
  "lv-LV": ["Nulle", "Nultais"],
  "nl-NL": ["Nul", "Nulde"],
  "pl-PL": ["Zero", "Zerowy"],
  "pt-BR": ["Zero", "Zero"],
  "pt-PT": ["Zero", "Zero"],
  "ru-RU": ["Ноль", "Нулевой"],
  "sk-SK": ["Nula", "Nultý"],
  "sr-Cyrl-RS": ["Нула", "Нулти"],
  "sr-Latn-RS": ["Nula", "Nulti"],
  "sv-SE": ["Noll", "Nollte"],
  "tr-TR": ["Sıfır", "Sıfırıncı"],
  "uk-UA": ["Нуль", "Нульовий"]
};

/**
 * Formats the lexical zero independently of positive-number grammar.
 *
 * @param format - Cardinal or ordinal text requested by the level.
 * @param language - Already selected marker language slot.
 * @returns Fixed observed zero word, with the existing English compatibility fallback.
 */
export function formatWordZeroText(
  format: "cardinalText" | "ordinalText",
  language: string
): string {
  const tuple = words[language] ?? ["Zero", "Zeroth"];
  return tuple[format === "cardinalText" ? 0 : 1];
}

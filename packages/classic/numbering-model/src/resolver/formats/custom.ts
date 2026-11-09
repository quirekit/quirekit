const upperTurkish = Array.from("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ");
const lowerTurkish = Array.from("abcçdefgğhıijklmnoöprsştuüvyz");

/**
 * Formats one Office 2010 custom numbering expression.
 *
 * @param value - Non-negative counter; zero has no Greek or alphabetic glyph.
 * @param expression - Exact `w:numFmt/@w:format` expression.
 * @returns Recognized custom marker or decimal fallback.
 */
export function formatCustomCounter(
  value: number,
  expression: string | undefined
): string {
  switch (expression) {
    case "α, β, γ, ...":
      return formatGreekNumeral(value);
    case "00001, 00002, 00003, ...":
      return String(value).padStart(5, "0");
    case "0001, 0002, 0003, ...":
      return String(value).padStart(4, "0");
    case "001, 002, 003, ...":
      return String(value).padStart(3, "0");
    case "A, Ç, Ĝ, ...":
      return formatRepeatedAlphabet(value, upperTurkish);
    case "a, ç, ĝ, ...":
      return formatRepeatedAlphabet(value, lowerTurkish);
    default:
      return String(value);
  }
}

/**
 * Formats one Greek numeral inside the 9,999-value custom cycle.
 *
 * @param value - Non-negative counter.
 * @returns Greek numeral text.
 */
function formatGreekNumeral(value: number): string {
  let normalized = ((value - 1) % 9_999) + 1;
  const ones = ["α", "β", "γ", "δ", "ε", "στ", "ζ", "η", "θ"] as const;
  const tens = ["ι", "κ", "λ", "μ", "ν", "ξ", "ο", "π", "ϟ"] as const;
  const hundreds = ["ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω", "ϡ"] as const;
  const output: string[] = [];
  const thousands = Math.floor(normalized / 1_000);
  normalized %= 1_000;
  const hundred = Math.floor(normalized / 100);
  normalized %= 100;
  const ten = Math.floor(normalized / 10);
  const one = normalized % 10;
  if (thousands > 0) output.push(`,${ones[thousands - 1] ?? thousands}`);
  if (hundred > 0) output.push(hundreds[hundred - 1] ?? String(hundred));
  if (ten > 0) output.push(tens[ten - 1] ?? String(ten));
  if (one > 0) output.push(ones[one - 1] ?? String(one));
  return output.join("");
}

/**
 * Formats one repeated Turkish alphabet sequence.
 *
 * @param value - Non-negative counter.
 * @param alphabet - Uppercase or lowercase Turkish alphabet.
 * @returns Repeated alphabet marker.
 */
function formatRepeatedAlphabet(
  value: number,
  alphabet: readonly string[]
): string {
  const normalized = ((value - 1) % 870) + 1;
  const zeroBased = normalized - 1;
  return (alphabet[zeroBased % alphabet.length] ?? "")
    .repeat(Math.floor(zeroBased / alphabet.length) + 1);
}

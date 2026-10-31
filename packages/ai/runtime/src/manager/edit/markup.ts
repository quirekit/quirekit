/** One formatted stretch of parsed inline text. */
export interface QuireAiInlineSpan {
  /** Start offset in the plain text. */
  readonly start: number;
  /** End offset in the plain text. */
  readonly end: number;
  /** Character format name. */
  readonly name: string;
  /** Format value. */
  readonly value: unknown;
}

/** Plain text with the formats its markup requested. */
export interface QuireAiInlineText {
  /** Text without markup. */
  readonly text: string;
  /** Formatted stretches, possibly nested. */
  readonly spans: readonly QuireAiInlineSpan[];
}

/** Character the program writes for a line break inside a paragraph; models write `<br/>`. */
export const quireAiLineBreak = "\u2028";

/**
 * Parses the inline markup of the document view: `**bold**`, `*italic*`,
 * `[text]{name:value, ...}`, `<br/>` line breaks and `\\` escapes. Unmatched delimiters stay literal.
 *
 * @param source - Marked-up text.
 * @returns Plain text and requested formats.
 * @throws SyntaxError when a `{...}` record is not valid.
 */
export function parseQuireAiInline(source: string): QuireAiInlineText {
  const spans: QuireAiInlineSpan[] = [];
  let text = "";

  /**
   * Parses until a closing delimiter.
   * @param start - Source index to start at.
   * @param close - Delimiter that ends this run, or undefined at top level.
   * @returns Index after the closing delimiter, or -1 when it never appears.
   */
  const parse = (start: number, close?: string): number => {
    let index = start;
    while (index < source.length) {
      if (close !== undefined && source.startsWith(close, index) && (close !== "*" || source[index + 1] !== "*")) {
        return index + close.length;
      }
      const char = source[index]!;
      if (source.startsWith("<br/>", index)) {
        text += quireAiLineBreak;
        index += "<br/>".length;
        continue;
      }
      if (char === "\\" && index + 1 < source.length) {
        text += source[index + 1];
        index += 2;
        continue;
      }
      const delimiter = source.startsWith("**", index) ? "**" : char === "*" ? "*" : char === "[" ? "[" : undefined;
      if (delimiter !== undefined) {
        const next = tryNested(index, delimiter);
        if (next !== -1) { index = next; continue; }
      }
      text += char;
      index += 1;
    }
    return close === undefined ? index : -1;
  };

  /**
   * Parses one nested construct, restoring state when it is unmatched.
   * @param index - Index of the opening delimiter.
   * @param delimiter - Opening delimiter.
   * @returns Index after the construct, or -1 to treat the delimiter literally.
   */
  const tryNested = (index: number, delimiter: "**" | "*" | "["): number => {
    const textStart = text.length;
    const spanCount = spans.length;
    const inner = parse(index + delimiter.length, delimiter === "[" ? "]" : delimiter);
    if (inner === -1 || text.length === textStart) {
      text = text.slice(0, textStart);
      spans.length = spanCount;
      return -1;
    }
    if (delimiter !== "[") {
      spans.push({ start: textStart, end: text.length, name: delimiter === "**" ? "bold" : "italic", value: true });
      return inner;
    }
    if (source[inner] !== "{") {
      text = text.slice(0, textStart);
      spans.length = spanCount;
      return -1;
    }
    const end = findRecordEnd(source, inner);
    for (const [name, value] of Object.entries(parseQuireAiRecord(source.slice(inner, end)))) {
      spans.push({ start: textStart, end: text.length, name, value });
    }
    return end;
  };

  parse(0);
  return { text, spans };
}

/**
 * Parses a `{name:value, ...}` record whose keys may be unquoted.
 * @param source - Record text including braces.
 * @returns Parsed record.
 * @throws SyntaxError when the record is not valid.
 */
export function parseQuireAiRecord(source: string): Record<string, unknown> {
  let quoted = "";
  let inString = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (inString) {
      quoted += char;
      if (char === "\\") { quoted += source[index + 1] ?? ""; index += 1; }
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") { inString = true; quoted += char; continue; }
    const key = /^[A-Za-z_][A-Za-z0-9_]*(?=\s*:)/u.exec(source.slice(index));
    if (key !== null && /[{,]\s*$/u.test(quoted)) {
      quoted += `"${key[0]}"`;
      index += key[0].length - 1;
      continue;
    }
    quoted += char;
  }
  const value: unknown = JSON.parse(quoted);
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new SyntaxError(`Not a record: ${source}`);
  return value as Record<string, unknown>;
}

/**
 * Finds the end of a brace-balanced record.
 * @param source - Source text.
 * @param start - Index of the opening brace.
 * @returns Index after the matching closing brace.
 * @throws SyntaxError when the record is not closed.
 */
function findRecordEnd(source: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]!;
    if (inString) {
      if (char === "\\") index += 1;
      else if (char === "\"") inString = false;
    } else if (char === "\"") inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && (depth -= 1) === 0) return index + 1;
  }
  throw new SyntaxError(`Unclosed format record: ${source.slice(start)}`);
}

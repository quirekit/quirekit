import { decodeString } from "micromark-util-decode-string";
import { normalizeUri } from "micromark-util-sanitize-uri";

/** @param value - Raw Markdown field. @returns Decoded escapes and character references, without DOM or document mutation. */
export function decodeMarkdownString(value: string): string { return decodeString(value); }

/** @param value - Raw destination without angle delimiters. @returns Normalized URI, or the decoded control-bearing value for policy rejection. */
export function decodeMarkdownDestination(value: string): string {
  const decoded = decodeString(value);
  return /[\u0000-\u001f\u007f]/u.test(decoded) ? decoded : normalizeUri(decoded);
}

/** @param value - Semantic field. @param delimiters - Delimiters used by its original source form. @returns Reversible source without accidental entity or delimiter interpretation. */
export function encodeMarkdownField(value: string, delimiters = ""): string {
  return [...value].map(character => character === "&" ? "&amp;"
    : character === "\\" || delimiters.includes(character) ? `\\${character}` : character).join("");
}

/**
 * @param url - Literal link destination.
 * @returns Its shortest CommonMark form: bare when no character needs delimiting, otherwise angle-bracketed.
 */
export function encodeMarkdownDestination(url: string): string {
  // Ampersands are escaped only where they would read as a character reference.
  const text = url.replace(/&(?=#?[0-9A-Za-z]+;)/gu, "&amp;");
  return url && /^[^\s()<>\\\u0000-\u001f\u007f]+$/u.test(url) ? text : `<${text.replace(/[\\<>]/gu, "\\$&")}>`;
}

import type { CommentAnchor, CommentQuote, CommentRange } from "../protocol/types";
import { CONTEXT_LENGTH } from "./policy";

/** @param source - Text. @param index - UTF-16 offset. @returns Whether the offset splits a surrogate pair. */
export function splitsSurrogate(source: string, index: number): boolean {
  if (index <= 0 || index >= source.length) return false;
  const before = source.charCodeAt(index - 1), after = source.charCodeAt(index);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

/**
 * Captures the quoted text with bounded context, never cutting a surrogate pair in half.
 * @param source - Current Markdown source.
 * @param range - Valid source interval.
 * @returns Quote suitable for later re-anchoring.
 */
export function createCommentQuote(source: string, range: CommentRange): CommentQuote {
  let start = Math.max(0, range.from - CONTEXT_LENGTH), end = Math.min(source.length, range.to + CONTEXT_LENGTH);
  if (splitsSurrogate(source, start)) start++;
  if (splitsSurrogate(source, end)) end--;
  return { exact: source.slice(range.from, range.to), prefix: source.slice(start, range.from), suffix: source.slice(range.to, end) };
}

/**
 * Builds the persistent anchor for a range of the current source.
 * @param source - Current Markdown source.
 * @param range - Interval inside the source; must not split a surrogate pair.
 * @param sourceHash - `hashCommentSource(source)`, computed once per export.
 * @returns Anchor whose hint is exact for this source.
 */
export function createCommentAnchor(source: string, range: CommentRange, sourceHash: string): CommentAnchor {
  const { from, to } = range;
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < from || to > source.length
    || splitsSurrogate(source, from) || splitsSurrogate(source, to)) throw new RangeError("invalid-source-range");
  return { quote: createCommentQuote(source, range), hint: { from, to }, hash: sourceHash };
}

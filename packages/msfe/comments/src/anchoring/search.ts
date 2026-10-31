import type { CommentQuote } from "../protocol/types";
import { MIN_CONTEXT_SCORE, MIN_DISTINCT_QUOTE, MIN_SCORE_LEAD } from "./policy";
import type { AnchorCandidate, AnchorFailure } from "./types";

/**
 * @param source - Text to search.
 * @param needle - Nonempty text.
 * @param limit - Maximum occurrences worth keeping.
 * @returns Start offsets in order, or null when the needle occurs more than `limit` times.
 */
export function findOccurrences(source: string, needle: string, limit: number): number[] | null {
  const found: number[] = [];
  for (let index = source.indexOf(needle); index >= 0; index = source.indexOf(needle, index + 1)) {
    if (found.length === limit) return null;
    found.push(index);
  }
  return found;
}

/** @param left - Text. @param right - Text. @returns Length of the shared ending. */
function sharedEnd(left: string, right: string): number {
  let length = 0;
  while (length < left.length && length < right.length && left[left.length - 1 - length] === right[right.length - 1 - length]) length++;
  return length;
}

/** @param left - Text. @param right - Text. @returns Length of the shared beginning. */
function sharedStart(left: string, right: string): number {
  let length = 0;
  while (length < left.length && length < right.length && left[length] === right[length]) length++;
  return length;
}

/**
 * Measures how well the text around a placement agrees with the stored context.
 * An empty stored side only agrees with the matching document boundary.
 * @param source - Current source.
 * @param from - Candidate start.
 * @param to - Candidate end.
 * @param quote - Stored quote.
 * @returns Agreement in `[0, 1]`.
 */
export function contextScore(source: string, from: number, to: number, quote: CommentQuote): number {
  const { prefix, suffix } = quote;
  const before = prefix.length ? sharedEnd(prefix, source.slice(Math.max(0, from - prefix.length), from)) / prefix.length : Number(from === 0);
  const after = suffix.length ? sharedStart(suffix, source.slice(to, to + suffix.length)) / suffix.length : Number(to === source.length);
  return (before + after) / 2;
}

/**
 * Picks the placement only when the evidence is unambiguous; ties never fall back to the first match.
 * @param candidates - Scored placements of the exact quote.
 * @param quoteLength - Length of the stored exact text.
 * @returns The chosen candidate or the failure kind.
 */
export function pickCandidate(candidates: readonly AnchorCandidate[], quoteLength: number): AnchorCandidate | AnchorFailure {
  if (!candidates.length) return "not-found";
  const ranked = [...candidates].sort((left, right) => right.score - left.score);
  const [best, second] = ranked;
  // A lone long quote is strong evidence by itself; short or repeated text needs agreeing context.
  if (!second) return best!.score >= MIN_CONTEXT_SCORE || quoteLength >= MIN_DISTINCT_QUOTE ? best! : "not-found";
  return best!.score >= MIN_CONTEXT_SCORE && best!.score - second.score >= MIN_SCORE_LEAD ? best! : "ambiguous";
}

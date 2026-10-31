import type { CommentQuote } from "../protocol/types";
import { FUZZY_MAX_LENGTH, FUZZY_MAX_PAIRS, FUZZY_MIN_LENGTH, FUZZY_MIN_SIMILARITY, FUZZY_SEED_LIMIT, MIN_SCORE_LEAD } from "./policy";
import { findOccurrences } from "./search";
import type { AnchorCandidate, AnchorFailure } from "./types";

/** Outcome of approximate matching, with the number of measured spans. */
export interface FuzzyResult {
  /** Chosen span, or why none was chosen. */
  readonly result: AnchorCandidate | AnchorFailure;
  /** Spans whose edit distance was measured. */
  readonly inspected: number;
}

/**
 * Banded Levenshtein distance that stops once the limit is exceeded.
 * @param left - Text.
 * @param right - Text.
 * @param limit - Largest distance of interest.
 * @returns Exact distance, or `limit + 1` when it is larger.
 */
export function boundedDistance(left: string, right: string, limit: number): number {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  const over = limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, column) => column <= limit ? column : over);
  for (let row = 1; row <= left.length; row++) {
    const current = new Array<number>(right.length + 1).fill(over);
    current[0] = row <= limit ? row : over;
    let best = current[0]!;
    // Only cells within `limit` of the diagonal can stay under the limit.
    for (let column = Math.max(1, row - limit); column <= Math.min(right.length, row + limit); column++) {
      const cost = left.charCodeAt(row - 1) === right.charCodeAt(column - 1) ? 0 : 1;
      current[column] = Math.min(over, previous[column - 1]! + cost, previous[column]! + 1, current[column - 1]! + 1);
      best = Math.min(best, current[column]!);
    }
    if (best > limit) return over;
    previous = current;
  }
  return previous[right.length]!;
}

/**
 * Locates a rewritten quote from seeds at its edges and in its context.
 * Seeds give start and end guesses; pairs of plausible length are measured by edit distance.
 * @param source - Current source.
 * @param quote - Stored quote with nonempty exact text.
 * @returns Best non-overlapping-unique span, or a failure.
 */
export function findFuzzy(source: string, quote: CommentQuote): FuzzyResult {
  const { exact, prefix, suffix } = quote, length = exact.length;
  if (length < FUZZY_MIN_LENGTH || length > FUZZY_MAX_LENGTH) return { result: "not-found", inspected: 0 };
  const seed = Math.min(16, Math.floor(length / 3));
  const starts = new Set<number>(), ends = new Set<number>();
  /** @param needle - Seed text. @param shift - Offset from seed start to the guessed boundary. @param into - Guess set. */
  const collect = (needle: string, shift: number, into: Set<number>): void => {
    if (needle.length < seed) return;
    for (const index of findOccurrences(source, needle, FUZZY_SEED_LIMIT) ?? []) into.add(index + shift);
  };
  collect(exact.slice(0, seed), 0, starts);
  collect(prefix.slice(-seed), seed, starts);
  collect(exact.slice(-seed), seed, ends);
  collect(suffix.slice(0, seed), 0, ends);
  // Pair guesses of plausible length; a lone side assumes the original length.
  const pairs = new Map<string, readonly [number, number]>();
  /** @param from - Guessed start. @param to - Guessed end. */
  const add =(from: number, to: number): void => {
    if (from >= 0 && to <= source.length && to - from >= length / 2 && to - from <= length * 1.5) pairs.set(`${from}:${to}`, [from, to]);
  };
  for (const from of starts) { add(from, from + length); for (const to of ends) add(from, to); }
  for (const to of ends) add(to - length, to);
  if (pairs.size > FUZZY_MAX_PAIRS) return { result: "ambiguous", inspected: 0 };
  const scored: AnchorCandidate[] = [];
  for (const [from, to] of pairs.values()) {
    const span = source.slice(from, to), longer = Math.max(length, span.length);
    const distance = boundedDistance(exact, span, Math.floor((1 - FUZZY_MIN_SIMILARITY) * longer));
    const score = 1 - distance / longer;
    if (score >= FUZZY_MIN_SIMILARITY) scored.push({ from, to, score });
  }
  if (!scored.length) return { result: "not-found", inspected: pairs.size };
  scored.sort((left, right) => right.score - left.score);
  const best = scored[0]!;
  // Spans overlapping the best one describe the same place with other bounds, not a rival.
  const rival = scored.find(other => other.to <= best.from || other.from >= best.to);
  return { result: rival && best.score - rival.score < MIN_SCORE_LEAD ? "ambiguous" : best, inspected: pairs.size };
}

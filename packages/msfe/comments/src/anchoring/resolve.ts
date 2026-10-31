import type { CommentAnchor, CommentQuote } from "../protocol/types";
import { findFuzzy } from "./fuzzy";
import { MAX_EXACT_CANDIDATES } from "./policy";
import { contextScore, findOccurrences, pickCandidate } from "./search";
import type { AnchorCandidate, AnchorResolution } from "./types";

/**
 * Places a stored anchor on the current source, preferring the strongest evidence and
 * orphaning the thread rather than guessing between equally plausible places.
 * Runs on import, epoch change or whole-source replacement, never per keystroke.
 * @param source - Current Markdown source.
 * @param anchor - Stored anchor.
 * @param sourceHash - `hashCommentSource(source)`, shared by all threads of one pass.
 * @returns Placement, or the orphan reason, with the candidate count examined.
 */
export function resolveCommentAnchor(source: string, anchor: CommentAnchor, sourceHash: string): AnchorResolution {
  const { quote, hint } = anchor;
  const fits = hint.to <= source.length && source.slice(hint.from, hint.to) === quote.exact;
  // Phase 1: the source the hint was taken from is unchanged.
  if (fits && anchor.hash === sourceHash) return { status: "resolved", range: { from: hint.from, to: hint.to }, method: "hash", inspected: 0 };
  // Phase 2: the quote and its full context are still at the hint, so nothing around it moved.
  if (fits && contextScore(source, hint.from, hint.to, quote) === 1) return { status: "resolved", range: { from: hint.from, to: hint.to }, method: "hint", inspected: 1 };
  // Phase 3: exact occurrences elsewhere, disambiguated by context.
  const candidates = exactCandidates(source, quote);
  if (candidates === null) return { status: "orphaned", reason: "ambiguous", inspected: 0 };
  const picked = pickCandidate(candidates, quote.exact.length);
  if (typeof picked !== "string") return resolved(picked, "exact", candidates.length);
  if (picked === "ambiguous" || !quote.exact.length || candidates.length) return { status: "orphaned", reason: picked, inspected: candidates.length };
  // Phase 4: the quote itself was rewritten; only reached when it occurs nowhere verbatim.
  const fuzzy = findFuzzy(source, quote);
  return typeof fuzzy.result === "string"
    ? { status: "orphaned", reason: fuzzy.result, inspected: fuzzy.inspected }
    : resolved(fuzzy.result, "fuzzy", fuzzy.inspected);
}

/** @param candidate - Chosen placement. @param method - Evidence. @param inspected - Work count. @returns Resolution. */
function resolved(candidate: AnchorCandidate, method: "exact" | "fuzzy", inspected: number): AnchorResolution {
  return { status: "resolved", range: { from: candidate.from, to: candidate.to }, method, inspected };
}

/**
 * Point comments have no text of their own, so their candidates come from the context on either side.
 * @param source - Current source.
 * @param quote - Stored quote.
 * @returns Scored placements, or null when the text repeats too often to judge.
 */
function exactCandidates(source: string, quote: CommentQuote): AnchorCandidate[] | null {
  const { exact, prefix, suffix } = quote;
  const spans = new Map<number, number>();
  if (exact.length) {
    const found = findOccurrences(source, exact, MAX_EXACT_CANDIDATES);
    if (!found) return null;
    for (const from of found) spans.set(from, from + exact.length);
  } else {
    if (!prefix.length && !suffix.length) return source.length ? [] : [{ from: 0, to: 0, score: 1 }];
    const before = prefix.length ? findOccurrences(source, prefix, MAX_EXACT_CANDIDATES) : [];
    const after = suffix.length ? findOccurrences(source, suffix, MAX_EXACT_CANDIDATES) : [];
    if (!before || !after) return null;
    for (const index of before) spans.set(index + prefix.length, index + prefix.length);
    for (const index of after) spans.set(index, index);
  }
  return [...spans].map(([from, to]) => ({ from, to, score: contextScore(source, from, to, quote) }));
}

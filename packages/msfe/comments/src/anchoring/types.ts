import type { CommentRange } from "../protocol/types";

/** How a resolved anchor was found, from strongest to weakest evidence. */
export type AnchorMethod = "hash" | "hint" | "exact" | "fuzzy";

/** Why an anchor could not be placed; both outcomes leave the thread orphaned. */
export type AnchorFailure = "not-found" | "ambiguous";

/** Outcome of placing one stored anchor on the current source. */
export type AnchorResolution =
  | {
    /** The anchor was placed. */
    readonly status: "resolved";
    /** Current UTF-16 source interval. */
    readonly range: CommentRange;
    /** Evidence used. */
    readonly method: AnchorMethod;
    /** Candidate positions examined, for work-bound checks. */
    readonly inspected: number;
  }
  | {
    /** The anchor could not be placed without guessing. */
    readonly status: "orphaned";
    /** Failure kind. */
    readonly reason: AnchorFailure;
    /** Candidate positions examined, for work-bound checks. */
    readonly inspected: number;
  };

/** One possible placement with its context agreement. */
export interface AnchorCandidate extends CommentRange {
  /** Agreement in `[0, 1]`; higher is better. */
  readonly score: number;
}

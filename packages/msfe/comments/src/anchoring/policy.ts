/** UTF-16 units of context stored on each side of the quote. */
export const CONTEXT_LENGTH = 32;

/** Exact occurrences beyond this count are too repetitive to disambiguate. */
export const MAX_EXACT_CANDIDATES = 256;

/** A single exact occurrence at least this long is accepted even when its context changed. */
export const MIN_DISTINCT_QUOTE = 8;

/** Minimum context agreement for any other accepted candidate. */
export const MIN_CONTEXT_SCORE = 0.5;

/** The best candidate must lead the runner-up by this much. */
export const MIN_SCORE_LEAD = 0.1;

/** Shorter quotes are too weak for approximate matching. */
export const FUZZY_MIN_LENGTH = 12;

/** Longer quotes skip approximate matching to bound edit-distance work. */
export const FUZZY_MAX_LENGTH = 2000;

/** Seed occurrences beyond this count make the seed useless. */
export const FUZZY_SEED_LIMIT = 16;

/** Start/end pairs beyond this count are too repetitive to disambiguate. */
export const FUZZY_MAX_PAIRS = 64;

/** Minimum similarity, `1 - distance / longer length`, for an approximate match. */
export const FUZZY_MIN_SIMILARITY = 0.75;

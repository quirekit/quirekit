import type { HtmlTextDesc } from "../../descriptors";

/**
 * Finds a direct text owner in non-overlapping document order.
 * @param texts - Cached text descriptors whose current ranges are already mapped.
 * @param pos - Canonical document position.
 * @param side - Preferred side at adjacent text boundaries.
 * @returns The same boundary owner selected by a full ordered scan.
 */
export function findHtmlTextDescriptor(
  texts: readonly HtmlTextDesc[],
  pos: number,
  side: number
): HtmlTextDesc | undefined {
  const candidate = texts[textEndingAt(texts, pos, side >= 0)];
  if (side < 0) {
    return candidate && candidate.range.from < pos ? candidate : undefined;
  }
  if (candidate && candidate.range.from <= pos) {
    return candidate;
  }
  const closed = texts[textEndingAt(texts, pos, false)];
  return closed && closed.range.from <= pos ? closed : undefined;
}

/**
 * Locates the first text range reaching the requested boundary.
 * @param texts - Ordered, non-overlapping text owners.
 * @param pos - Canonical position to locate.
 * @param exclusive - Whether a text ending exactly at the position precedes the match.
 * @returns Matching index, or the array length beyond the final text.
 */
function textEndingAt(
  texts: readonly HtmlTextDesc[],
  pos: number,
  exclusive: boolean
): number {
  let from = 0;
  let to = texts.length;
  while (from < to) {
    const middle = Math.floor((from + to) / 2);
    const end = texts[middle]!.range.to;
    if (end < pos || exclusive && end === pos) {
      from = middle + 1;
    } else {
      to = middle;
    }
  }
  return from;
}

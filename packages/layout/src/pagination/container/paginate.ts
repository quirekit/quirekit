import type {
  QuireMeasuredContainerPaginationOptions,
  QuireMeasuredContainerPaginationResult
} from "./types";
import { paginateQuireMeasuredContainerCore } from "./core";
import { applyQuireKeepWithNextTail } from "./keep-tail";
import { applyQuireWidowOrphanControl } from "./widow-orphan";
import { placeQuireFragmentNotes, withQuirePendingNotes } from "./notes";
import { clampQuireMeasuredContainerStartIndex } from "./range";

/**
 * Paginates measured container items against a single available height.
 *
 * Applies widow/orphan control as a forward-only post-step: when a group (e.g. a
 * paragraph) spans the page break with too few lines on either side, the spill
 * point is moved earlier so more lines fall to the next page. This never rebuilds a
 * prior page, so no backtrack is needed. Control is off by default (widows and
 * orphans both `1`). A splittable keep-with-next group then carries its tail to
 * its successor's page the same forward-only way.
 *
 * @param options - Measured container pagination inputs.
 * @returns Pagination result for the accepted fragment.
 */
export function paginateQuireMeasuredContainer(
  options: QuireMeasuredContainerPaginationOptions
): QuireMeasuredContainerPaginationResult {
  const result = paginateQuireMeasuredContainerCore(options);

  if (result.kind !== "spill"
    || options.container.items[result.nextIndex - 1]?.breakAfter !== undefined
    || options.container.items[result.nextIndex]?.breakBefore === "page") {
    return withQuireFragmentNotes(result, options);
  }

  const controlled = applyQuireWidowOrphanControl(result, options);
  return withQuireFragmentNotes(controlled.kind === "spill" ? applyQuireKeepWithNextTail(controlled, options) : controlled, options);
}

/**
 * Places the fragment's notes from its final accepted items.
 *
 * Runs after widow/orphan adjustment so moved lines take their notes along.
 * Notes still continuing when the container ends overflow onto the last fragment.
 *
 * @param result - Final pagination result.
 * @param options - Container pagination inputs.
 * @returns Result carrying note parts and the continuation for the next fragment.
 */
function withQuireFragmentNotes(
  result: QuireMeasuredContainerPaginationResult,
  options: QuireMeasuredContainerPaginationOptions
): QuireMeasuredContainerPaginationResult {
  if (result.kind === "backtrack") {
    return result;
  }
  const startIndex = clampQuireMeasuredContainerStartIndex(options.startIndex, options.container.items.length);
  const finished = result.kind === "done" || result.nextIndex >= options.container.items.length;
  const placement = placeQuireFragmentNotes(
    finished ? { ...options, availableHeight: Number.POSITIVE_INFINITY } : options,
    startIndex,
    result.nextIndex,
    result.consumedHeight
  );
  const endInfo = withQuirePendingNotes(result.endInfo, placement.pending);
  if (placement.notes.length === 0) {
    return endInfo === result.endInfo ? result : { ...result, endInfo };
  }
  return { ...result, endInfo, notes: placement.notes, noteAreaHeight: placement.height };
}

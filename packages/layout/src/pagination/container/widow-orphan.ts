import type { QuireDocumentRange } from "@quirekit/renderer";
import {
  clampQuireMeasuredContainerStartIndex,
  createCollapsedQuireRange,
  extendQuireMeasuredContainerRange
} from "./range";
import { mergeQuireMeasuredContainerEndInfo } from "./end-info";
import type {
  QuireMeasuredContainerPaginationOptions,
  QuireMeasuredContainerPaginationResult
} from "./types";

/**
 * Moves a spill point earlier when a group spans the break with too few lines.
 *
 * @param spill - Natural spill result from the core pagination pass.
 * @param options - Measured container pagination inputs.
 * @returns Adjusted spill result, or the original when no adjustment applies.
 */
export function applyQuireWidowOrphanControl(
  spill: QuireMeasuredContainerPaginationResult & { readonly kind: "spill" },
  options: QuireMeasuredContainerPaginationOptions
): QuireMeasuredContainerPaginationResult {
  const items = options.container.items;
  const startIndex = clampQuireMeasuredContainerStartIndex(options.startIndex, items.length);
  const breakIndex = spill.nextIndex;
  const group = items[breakIndex]?.group;

  if (group === undefined) {
    return spill;
  }

  const groupItem = items[breakIndex] ?? items[breakIndex - 1];
  const widows = Math.max(
    1,
    Math.trunc(groupItem?.groupWidows ?? options.widows ?? 1)
  );
  const orphans = Math.max(
    1,
    Math.trunc(groupItem?.groupOrphans ?? options.orphans ?? 1)
  );

  let remaining = 0;
  for (let i = breakIndex; i < items.length && items[i]!.group === group; i += 1) {
    remaining += 1;
  }

  let accepted = 0;
  for (let i = breakIndex - 1; i >= startIndex && items[i]!.group === group; i -= 1) {
    accepted += 1;
  }

  if (accepted === 0) {
    return spill;
  }

  let nextIndex = breakIndex;
  if (accepted < orphans) {
    // Too few lines at the page bottom: push the whole group to the next page.
    nextIndex = breakIndex - accepted;
  } else if (remaining < widows) {
    // Too few lines at the next page top: push lines down, keeping orphans here.
    nextIndex = breakIndex - Math.min(widows - remaining, accepted - orphans);
  }

  if (nextIndex <= startIndex || nextIndex >= breakIndex) {
    return spill;
  }

  return recomputeQuireMeasuredContainerSpill(options, startIndex, nextIndex);
}

/**
 * Recomputes a spill payload for a reduced accepted item range.
 *
 * @param options - Measured container pagination inputs.
 * @param startIndex - First accepted item index.
 * @param nextIndex - Exclusive end of the accepted range and resume index.
 * @returns Spill result for the accepted range.
 */
export function recomputeQuireMeasuredContainerSpill(
  options: QuireMeasuredContainerPaginationOptions,
  startIndex: number,
  nextIndex: number
): QuireMeasuredContainerPaginationResult {
  const items = options.container.items;
  let consumedHeight = 0;
  let endInfo = options.incomingEndInfo;
  let acceptedRange: QuireDocumentRange | null = null;

  for (let index = startIndex; index < nextIndex; index += 1) {
    const item = items[index]!;
    const itemGap = acceptedRange === null ? 0 : Math.max(0, item.gapBefore ?? 0);
    consumedHeight += itemGap + Math.max(0, item.height);
    acceptedRange = extendQuireMeasuredContainerRange(acceptedRange, item.range);
    endInfo = mergeQuireMeasuredContainerEndInfo(endInfo, item.endInfo);
  }

  return {
    kind: "spill",
    range: acceptedRange ?? createCollapsedQuireRange(items[startIndex]!.range.from),
    consumedHeight,
    nextIndex,
    endInfo
  };
}

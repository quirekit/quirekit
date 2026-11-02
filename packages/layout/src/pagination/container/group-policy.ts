import type {
  QuireMeasuredContainerItem,
  QuireMeasuredContainerPaginationOptions
} from "./types";

/**
 * Tests whether a group-level policy should move the current group to a fresh page.
 *
 * @param options - Current measured-container pagination request.
 * @param index - Candidate item index at the start of a group.
 * @param consumedHeight - Height already accepted on the current page.
 * @param hasAcceptedItems - Whether the current page already accepted an item.
 * @param successorPrefixes - Prefix heights memoized only for this pagination call.
 * @returns Whether pagination should spill immediately before the candidate group.
 */
export function shouldSpillBeforeQuireMeasuredGroup(
  options: QuireMeasuredContainerPaginationOptions,
  index: number,
  consumedHeight: number,
  hasAcceptedItems: boolean,
  successorPrefixes: Map<number, number>
): boolean {
  const items = options.container.items;
  const item = items[index];
  if (item === undefined || !isQuireMeasuredGroupStart(items, index)) {
    return false;
  }

  const groupEnd = findQuireMeasuredGroupEnd(items, index);
  const groupHeight = measureQuireMeasuredItemRun(items, index, groupEnd);
  const leadingGap = hasAcceptedItems
    ? Math.max(0, item.gapBefore ?? 0)
    : 0;
  const shouldKeepTogether = item.keepTogether === true;
  const nextItem = items[groupEnd];
  // A splittable keep-with-next group flows line by line; its tail is carried to the successor afterwards.
  const keepWithNextHeight = item.keepWithNext === true && !canQuireMeasuredGroupSplit(options, index, groupEnd)
    && nextItem !== undefined
    && items[groupEnd - 1]?.breakAfter === undefined && nextItem.breakBefore !== "page"
    ? groupHeight
      + Math.max(0, nextItem.gapBefore ?? 0)
      + measureSuccessorPrefix(options, groupEnd, successorPrefixes)
    : null;
  const freshPageRequirement = keepWithNextHeight
    ?? (shouldKeepTogether ? groupHeight : null);

  if (
    freshPageRequirement === null
    || freshPageRequirement > options.availableHeight
  ) {
    return false;
  }

  const currentPageRequirement = consumedHeight
    + leadingGap
    + freshPageRequirement;
  if (currentPageRequirement <= options.availableHeight) {
    return false;
  }

  return hasAcceptedItems || !options.isPageTop;
}

/**
 * Reserves the successor's legal first-page prefix before committing its heading.
 * The later keep-together/orphan pass must not move a successor after its heading
 * has already been accepted. All lengths are existing measured CSS pixels.
 * @param options - Container and fresh-page budget.
 * @param start - First successor item.
 * @param cache - Call-local group prefix heights, preventing repeated traversal of keep chains.
 * @returns Minimum successor height that can remain with the preceding group.
 */
function measureSuccessorPrefix(options: QuireMeasuredContainerPaginationOptions, start: number, cache: Map<number, number>): number {
  const items = options.container.items;
  const chain: number[] = [];
  let cursor = start;
  // Follow only connected keep groups. A local work stack avoids recursion for
  // long selections, while memoized suffixes are shared by later group checks.
  while (!cache.has(cursor)) {
    const first = items[cursor]!;
    const end = findQuireMeasuredGroupEnd(items, cursor);
    if (first.keepWithNext === true && !canQuireMeasuredGroupSplit(options, cursor, end) && items[end] !== undefined
      && items[end - 1]?.breakAfter === undefined && items[end]?.breakBefore !== "page") {
      chain.push(cursor);
      cursor = end;
    } else {
      cache.set(cursor, measureUnlinkedPrefix(options, cursor, end));
      break;
    }
  }
  // Resolve from the tail: only a chain that fits a fresh page is indivisible.
  // Oversized chains retain the existing legal-prefix fallback and forward progress.
  while (chain.length > 0) {
    const current = chain.pop()!;
    const end = findQuireMeasuredGroupEnd(items, current);
    const height = measureQuireMeasuredItemRun(items, current, end)
      + Math.max(0, items[end]!.gapBefore ?? 0) + cache.get(end)!;
    cache.set(current, height <= options.availableHeight ? height : measureUnlinkedPrefix(options, current, end));
  }
  return cache.get(start)!;
}

/**
 * Tests whether a group may break across pages with its orphan and widow minimums on either side.
 * @param options - Container pagination inputs supplying the default minimums.
 * @param start - First group item.
 * @param end - Exclusive group end.
 * @returns Whether the group is neither kept together nor too short to split.
 */
export function canQuireMeasuredGroupSplit(options: QuireMeasuredContainerPaginationOptions, start: number, end: number): boolean {
  const first = options.container.items[start]!;
  if (first.keepTogether === true || first.group === undefined) return false;
  const widows = Math.max(1, Math.trunc(first.groupWidows ?? options.widows ?? 1));
  const orphans = Math.max(1, Math.trunc(first.groupOrphans ?? options.orphans ?? 1));
  return end - start >= widows + orphans;
}

/**
 * Measures the legal prefix when no further keep constraint can be honored.
 * @param options - Container and fresh-page budget.
 * @param start - First group item.
 * @param end - Exclusive group end.
 * @returns Entire keep-together group or its orphan minimum.
 */
function measureUnlinkedPrefix(options: QuireMeasuredContainerPaginationOptions, start: number, end: number): number {
  const items = options.container.items;
  const first = items[start]!;
  const height = measureQuireMeasuredItemRun(items, start, end);
  if (first.keepTogether === true && height <= options.availableHeight) return height;
  const orphans = Math.max(1, Math.trunc(first.groupOrphans ?? options.orphans ?? 1));
  return measureQuireMeasuredItemRun(items, start, Math.min(end, start + orphans));
}

/**
 * Tests whether an item begins its complete source group.
 *
 * @param items - Ordered measured items.
 * @param index - Candidate group-start index.
 * @returns Whether the candidate starts a complete group.
 */
function isQuireMeasuredGroupStart(
  items: readonly QuireMeasuredContainerItem[],
  index: number
): boolean {
  const group = items[index]?.group;
  if (group === undefined) {
    return true;
  }

  return index === 0 || items[index - 1]?.group !== group
    || items[index - 1]?.breakAfter !== undefined || items[index]?.breakBefore === "page";
}

/**
 * Finds the exclusive end index of the candidate item's contiguous group.
 *
 * @param items - Ordered measured items.
 * @param startIndex - First item in the group.
 * @returns Exclusive group end index.
 */
function findQuireMeasuredGroupEnd(
  items: readonly QuireMeasuredContainerItem[],
  startIndex: number
): number {
  const group = items[startIndex]?.group;
  if (group === undefined) {
    return startIndex + 1;
  }

  let endIndex = startIndex + 1;
  while (endIndex < items.length && items[endIndex]?.group === group
    && items[endIndex - 1]?.breakAfter === undefined && items[endIndex]?.breakBefore !== "page") {
    endIndex += 1;
  }
  return endIndex;
}

/**
 * Measures a contiguous item run as it would appear at the top of a fresh page.
 *
 * @param items - Ordered measured items.
 * @param startIndex - Inclusive run start.
 * @param endIndex - Exclusive run end.
 * @returns Fresh-page height with the first leading gap collapsed.
 */
function measureQuireMeasuredItemRun(
  items: readonly QuireMeasuredContainerItem[],
  startIndex: number,
  endIndex: number
): number {
  let height = 0;
  for (let index = startIndex; index < endIndex; index += 1) {
    const item = items[index]!;
    const gap = index === startIndex ? 0 : Math.max(0, item.gapBefore ?? 0);
    height += gap + Math.max(0, item.height);
  }
  return height;
}

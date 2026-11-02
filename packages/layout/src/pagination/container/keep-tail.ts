import { canQuireMeasuredGroupSplit } from "./group-policy";
import { clampQuireMeasuredContainerStartIndex } from "./range";
import type {
  QuireMeasuredContainerPaginationOptions,
  QuireMeasuredContainerPaginationResult
} from "./types";
import { recomputeQuireMeasuredContainerSpill } from "./widow-orphan";

/**
 * Carries the tail of a splittable keep-with-next group to the page of its successor.
 *
 * Runs after widow/orphan control. It applies only when the break falls exactly
 * between the group and its successor: the group's last widow-minimum lines move
 * down, the rest still fills this page. When too few lines would stay, a group
 * that began on this page moves whole; a continued one keeps the natural break so
 * the page is never emptied. Forward-only, like widow/orphan control.
 *
 * @param spill - Spill result after widow/orphan control.
 * @param options - Measured container pagination inputs.
 * @returns Adjusted spill result, or the original when no adjustment applies.
 */
export function applyQuireKeepWithNextTail(
  spill: QuireMeasuredContainerPaginationResult & { readonly kind: "spill" },
  options: QuireMeasuredContainerPaginationOptions
): QuireMeasuredContainerPaginationResult {
  const items = options.container.items;
  const startIndex = clampQuireMeasuredContainerStartIndex(options.startIndex, items.length);
  const breakIndex = spill.nextIndex;
  const last = items[breakIndex - 1];
  const group = last?.group;
  if (last?.keepWithNext !== true || group === undefined || items[breakIndex] === undefined
    || items[breakIndex]!.group === group) {
    return spill;
  }

  let groupStart = breakIndex - 1;
  while (groupStart > 0 && items[groupStart - 1]!.group === group) groupStart -= 1;
  if (!canQuireMeasuredGroupSplit(options, groupStart, breakIndex)) return spill;

  const startedHere = groupStart >= startIndex;
  const accepted = breakIndex - Math.max(groupStart, startIndex);
  const widows = Math.max(1, Math.trunc(last.groupWidows ?? options.widows ?? 1));
  const orphans = Math.max(1, Math.trunc(last.groupOrphans ?? options.orphans ?? 1));
  // Lines left here end a page-bottom fragment (orphans) or, when continued, top one (widows).
  const nextIndex = accepted - widows >= (startedHere ? orphans : widows)
    ? breakIndex - widows
    : startedHere ? groupStart : breakIndex;

  if (nextIndex <= startIndex || nextIndex >= breakIndex) return spill;
  return recomputeQuireMeasuredContainerSpill(options, startIndex, nextIndex);
}

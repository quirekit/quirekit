import { doQuireRectsIntersect, type QuireRect } from "@quirekit/renderer";
import type { QuireLayoutInteractionQueryIndex, QuireLayoutNode } from "@quirekit/view-engine";

/**
 * Rebinds a flat native flow without recollecting paths or assigning new entry identities.
 * @param previous - Complete previous interaction index with stable block topology.
 * @param blocks - Current source-bound blocks in the same order.
 * @param viewportRect - Current continuous-flow bucket bounds.
 * @returns Current immutable index, retaining untouched entries and bucket memberships.
 */
export function refitHtmlFlowQueryIndex(previous: QuireLayoutInteractionQueryIndex,
  blocks: readonly QuireLayoutNode[], viewportRect: QuireRect): QuireLayoutInteractionQueryIndex {
  let geometryChanged = false;
  const entries = previous.entries.map((entry, index) => {
    const node = blocks[index]!;
    geometryChanged ||= entry.rect !== node.rect;
    return entry.range === node.range && entry.rect === node.rect ? entry
      : { ...entry, range: node.range, rect: node.rect };
  });
  const bucket = previous.buckets[0];
  if (!geometryChanged && bucket && sameRect(bucket.rect, viewportRect)) return { ...previous, entries };
  const included: number[] = [], outside: number[] = [];
  entries.forEach((entry, index) => (doQuireRectsIntersect(entry.rect, viewportRect) ? included : outside).push(index));
  return { entries, entryCount: entries.length,
    buckets: [{ bucketId: "viewport:snapshot", rect: viewportRect, entryIndexes: included }],
    unbucketedEntryIndexes: outside };
}

/** @param a - Previous box. @param b - Current box. @returns Whether bucket membership can be retained. */
function sameRect(a: QuireRect, b: QuireRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

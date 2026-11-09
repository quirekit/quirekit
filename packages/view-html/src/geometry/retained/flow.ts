import type { QuireRect } from "@quirekit/renderer";
import type { HtmlFlowRectUpdate } from "./types";

/**
 * Updates admitted native block flow, checking real boundaries before publication.
 * @param options - Previous boxes, text-write indexes and current native measurements.
 * @returns Exact next boxes, or null when normal-flow propagation is not proven.
 */
export function updateHtmlFlowRects(options: HtmlFlowRectUpdate): readonly QuireRect[] | null {
  const { previous } = options;
  if (!previous.length) return null;
  const changed = [...new Set(options.changed)].sort((a, b) => a - b);
  const measured = new Map<number, QuireRect>();
  /** @param index - Block to read once. @returns Its current surface-local rectangle. */
  const read = (index: number): QuireRect => {
    let rect = measured.get(index);
    if (!rect) { rect = options.read(index); measured.set(index, rect); }
    return rect;
  };

  // Pure text preserves margins and inline width in the admitted block formatting
  // context. Only measured block heights may move subsequent block origins.
  const deltas = new Map<number, number>();
  let delta = 0;
  for (const index of changed) {
    const before = previous[index];
    if (!before) return null;
    const current = read(index);
    if (!close(current.x, before.x) || !close(current.width, before.width)
      || !close(current.y, before.y + delta) || current.height <= 0) return null;
    const difference = current.height - before.height;
    deltas.set(index, difference);
    delta += difference;
  }
  // scrollHeight is integer-rounded whereas native rectangles are fractional.
  if (Math.abs(options.height - options.previousHeight - delta) > 1) return null;

  const probes = new Set([0, previous.length - 1]);
  for (const index of changed) {
    if (index > 0) probes.add(index - 1);
    if (index + 1 < previous.length) probes.add(index + 1);
  }
  let cursor = 0, shift = 0;
  for (const index of [...probes].sort((a, b) => a - b)) {
    while (cursor < changed.length && changed[cursor]! < index) shift += deltas.get(changed[cursor++]!)!;
    if (deltas.has(index)) continue;
    const before = previous[index]!, current = read(index);
    if (!close(current.x, before.x) || !close(current.y, before.y + shift)
      || !close(current.width, before.width) || !close(current.height, before.height)) return null;
  }
  if ([...deltas.values()].every(value => value === 0)) return previous;

  // Keep old snapshots immutable. Position-binding remains a separate linear
  // pass; untouched geometry before the first height change is shared.
  delta = 0;
  return previous.map((rect, index) => {
    const change = deltas.get(index) ?? 0;
    const next = delta === 0 && change === 0 ? rect
      : { ...rect, y: rect.y + delta, height: rect.height + change };
    delta += change;
    return next;
  });
}

/** @param first - Observed CSS value. @param second - Predicted CSS value. @returns Native subpixel equality. */
function close(first: number, second: number): boolean {
  return Math.abs(first - second) < 0.02;
}

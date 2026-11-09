import { describe, expect, it } from "vitest";
import { updateHtmlFlowRects } from "./flow";
import type { QuireRect } from "@quirekit/renderer";

/** @param count - Number of natural-flow blocks. @returns Immutable measured boxes. */
function boxes(count: number): readonly QuireRect[] {
  return Array.from({ length: count }, (_, i) => ({ x: 8, y: i * 30, width: 600, height: 20 }));
}

describe("retained native block flow", () => {
  it("bounds DOM reads for a local edit and reuses unchanged rectangles", () => {
    const previous = boxes(1000), reads: number[] = [];
    const result = updateHtmlFlowRects({ previous, changed: [450], previousHeight: 30_000, height: 30_000,
      read: index => { reads.push(index); return { ...previous[index]! }; } });
    expect(result).toBe(previous);
    expect(reads.length).toBeLessThanOrEqual(5);
    expect(new Set(reads).size).toBe(reads.length);
  });
  it("propagates multiple height changes and matches an independently laid out flow", () => {
    const previous = boxes(1000);
    const expected = previous.map((rect, i) => ({ ...rect,
      y: rect.y + (i > 12 ? 20 : 0) + (i > 700 ? -10 : 0),
      height: rect.height + (i === 12 ? 20 : 0) + (i === 700 ? -10 : 0) }));
    let reads = 0;
    const result = updateHtmlFlowRects({ previous, changed: [700, 12], previousHeight: 30_000, height: 30_010,
      read: index => { reads++; return expected[index]!; } });
    expect(result).toEqual(expected);
    expect(reads).toBeLessThanOrEqual(8);
    expect(previous).toEqual(boxes(1000));
  });
  it("rejects changed width, boundary displacement and unexpected document height", () => {
    const previous = boxes(100);
    for (const changedIndex of [0, 49, 50, 51, 99]) {
      expect(updateHtmlFlowRects({ previous, changed: [50], previousHeight: 3000, height: 3000,
        read: index => index === changedIndex ? { ...previous[index]!, x: 20 } : previous[index]!
      })).toBeNull();
    }
    expect(updateHtmlFlowRects({ previous, changed: [50], previousHeight: 3000, height: 3040,
      read: index => previous[index]! })).toBeNull();
  });
  it("sweeps interleaved edits without rereading shared boundaries", () => {
    const previous = boxes(1000), changed = Array.from({ length: 500 }, (_, index) => index * 2);
    const expected = previous.map((rect, index) => ({ ...rect,
      y: rect.y + Math.ceil(index / 2), height: rect.height + (index % 2 === 0 ? 1 : 0) }));
    let reads = 0;
    expect(updateHtmlFlowRects({ previous, changed, previousHeight: 30_000, height: 30_500,
      read: index => { reads++; return expected[index]!; } })).toEqual(expected);
    expect(reads).toBe(1000);
  });
});

import { describe, expect, it } from "vitest";
import { createQuireLayoutInteractionQueryIndex, type QuireLayoutNode } from "@quirekit/view-engine";
import { refitHtmlFlowQueryIndex } from "./query-index";

describe("HTML flow query bindings", () => {
  it("matches complete compilation for source shifts, wrapping and viewport changes", () => {
    const children = Array.from({ length: 100 }, (_, i): QuireLayoutNode => ({
      id: String(i), kind: "block", range: { from: i * 10, to: i * 10 + 10 },
      rect: { x: 10, y: i * 25, width: 600, height: 20 }
    }));
    const root: QuireLayoutNode = { id: "root", kind: "block", range: { from: 0, to: 1000 },
      rect: { x: 0, y: 0, width: 640, height: 2500 }, children };
    const viewport = { x: 0, y: 300, width: 640, height: 500 };
    const previous = createQuireLayoutInteractionQueryIndex({ root, viewportRect: viewport })!;
    const saved = JSON.stringify(previous);
    for (const wrap of [false, true]) {
      const blocks = children.map((node, i) => i < 20 ? node : { ...node,
        range: { from: node.range.from + (i > 20 ? 2 : 0), to: node.range.to + 2 },
        rect: !wrap ? node.rect : { ...node.rect, y: node.rect.y + (i > 20 ? 30 : 0), height: i === 20 ? 50 : 20 }
      });
      for (const viewportRect of [viewport, { ...viewport, y: 1400 }]) {
        const actual = refitHtmlFlowQueryIndex(previous, blocks, viewportRect);
        expect(actual).toEqual(createQuireLayoutInteractionQueryIndex({ root: { ...root, children: blocks }, viewportRect }));
        expect(actual.entries[0]).toBe(previous.entries[0]);
        if (!wrap && viewportRect === viewport) expect(actual.buckets).toBe(previous.buckets);
      }
    }
    expect(JSON.stringify(previous)).toBe(saved);
  });
});

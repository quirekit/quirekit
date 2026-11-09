import { describe, expect, it } from "vitest";
import type { QuireLayoutNode } from "@quirekit/view-engine";
import { createHtmlBlockHitTree, queryHtmlBlockHitTree } from "./regions";
import { refitHtmlBlockHitTree } from "./refit";

/** @param children - Ordered blocks. @returns Complete measured test root. */
function root(children: readonly QuireLayoutNode[]): QuireLayoutNode {
  return { id: "root", kind: "block", range: { from: 0, to: 100_000 },
    rect: { x: 0, y: 0, width: 600, height: 40_000 }, children };
}

describe("HTML spatial tree refitting", () => {
  it("matches full reconstruction for every row, gaps and source scopes after height/range changes", () => {
    const before = Array.from({ length: 1000 }, (_, i): QuireLayoutNode => ({
      id: String(i), kind: "block", range: { from: i * 20, to: i * 20 + 20 },
      rect: { x: 5, y: i * 30, width: 550, height: 20 }
    }));
    const tree = createHtmlBlockHitTree(root(before));
    const saved = JSON.stringify(tree);
    const after = before.map((node, i) => i < 400 ? node : { ...node,
      range: { from: node.range.from + (i > 400 ? 150 : 0), to: node.range.to + 150 },
      rect: { ...node.rect, y: node.rect.y + (i > 400 ? 60 : 0), height: i === 400 ? 80 : 20 }
    });
    const refit = refitHtmlBlockHitTree(tree, new Map(after.slice(400).map(node => [node.id, node])));
    const rebuilt = createHtmlBlockHitTree(root(after));
    for (const node of after) {
      for (const y of [node.rect.y - 4, node.rect.y + 10, node.rect.y + node.rect.height + 4]) {
        for (const scope of [undefined, { from: 8050, to: 15_000 }]) {
          const actual = queryHtmlBlockHitTree(refit, { x: 620, y }, scope);
          expect(actual.block).toEqual(queryHtmlBlockHitTree(rebuilt, { x: 620, y }, scope).block);
          expect(actual.visited).toBeLessThan(50);
        }
      }
    }
    expect(JSON.stringify(tree)).toBe(saved);
    expect(refitHtmlBlockHitTree(tree, new Map())).toBe(tree);
  });
});

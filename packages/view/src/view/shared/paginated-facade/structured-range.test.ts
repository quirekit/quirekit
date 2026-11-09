import { QuireEditor } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import { describe, expect, it, vi } from "vitest";
import type { QuireViewRenderResult } from "../../types";
import { createMountedPaginatedGeometryFacade } from "./geometry";

/** @returns A retained frame holding one table fragment with two cells, and the facade over it. */
function fixture() {
  const editor = new QuireEditor({ extensions: [StarterKit], content: { type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "abcdefghijklmnop" }] }] } });
  const document = editor.state.doc;
  const cell = (id: string, from: number, x: number) => ({ id, kind: "cell", tableId: "t", semanticCellId: id, originExplicitCellId: id,
    explicitCellIds: [id], originCellPos: from, range: { from, to: from + 4 }, rect: { x, y: 10, width: 40, height: 20 } });
  const snapshot = { state: editor.state, viewGraph: { version: 3 },
    root: { id: "root", kind: "block", range: { from: 0, to: document.content.size }, rect: { x: 0, y: 0, width: 200, height: 100 },
      children: [{ id: "page", kind: "block", range: { from: 0, to: document.content.size }, rect: { x: 0, y: 0, width: 200, height: 100 },
        children: [{ id: "table", kind: "block", range: { from: 2, to: 12 }, rect: { x: 0, y: 10, width: 120, height: 20 },
          table: { cells: [cell("a", 2, 0), cell("b", 6, 40), cell("c", 10, 80)] } }] }] } };
  let result: QuireViewRenderResult | undefined = { layoutSnapshot: snapshot, interactionSnapshot: snapshot } as unknown as QuireViewRenderResult;
  const readSelectionContext = vi.fn(() => { throw new Error("A remote range must not borrow local selection ownership"); });
  const facade = createMountedPaginatedGeometryFacade({ backendLabel: "Test", readRenderResult: () => result,
    readSelectionContext, readSurface: () => ({ clientRect: { left: 100, top: 50, width: 400, height: 200 },
      surfaceBounds: { x: 0, y: 0, width: 200, height: 100 } }) });
  return { editor, document, facade, readSelectionContext, clear: () => { result = undefined; } };
}

describe("passive structured range queries", () => {
  it("projects the boxes of the cells inside a range without reading local selection", () => {
    const f = fixture();
    try {
      expect(f.facade.getStructuredRangeRects({ from: 2, to: 10 }, f.document)).toEqual([
        { x: 100, y: 70, width: 80, height: 40 }, { x: 180, y: 70, width: 80, height: 40 }
      ]);
      expect(f.facade.getStructuredRangeRects({ from: 3, to: 5 }, f.document)).toEqual([]);
      expect(f.readSelectionContext).not.toHaveBeenCalled();
    } finally { f.editor.destroy(); }
  });

  it("refuses stale source, invalid ranges and unavailable frames", () => {
    const f = fixture();
    try {
      const stale = f.document.type.create(f.document.attrs, f.document.content);
      expect(f.facade.getStructuredRangeRects({ from: 2, to: 10 }, stale)).toBeNull();
      for (const range of [{ from: -1, to: 7 }, { from: 2, to: 1 }, { from: 1, to: 99 }]) expect(f.facade.getStructuredRangeRects(range, f.document)).toBeNull();
      f.clear();
      expect(f.facade.getStructuredRangeRects({ from: 2, to: 10 }, f.document)).toBeNull();
    } finally { f.editor.destroy(); }
  });
});

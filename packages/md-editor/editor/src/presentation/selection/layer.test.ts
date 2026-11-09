// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorSelection, EditorState } from "@quirekit/cm-state";
import { Direction, type EditorView } from "@quirekit/cm-view";
import { modeFacet } from "@quirekit/msfe-core/state";
import { measureDocumentSelection } from "./layer";

afterEach(() => vi.restoreAllMocks());

describe("document selection measurement bounds", () => {
  /** @param selection - Canonical ranges in a long source document. @param mode - Native editor mode. @param lines - Distinct endpoint text owners. @returns A viewport-limited native measurement boundary. */
  function fixture(selection: EditorSelection, mode: "live" | "source" = "live", lines = 0) {
    const state = EditorState.create({ doc: "x".repeat(1_000_000), selection, extensions: [modeFacet.of(mode), EditorState.allowMultipleSelections.of(true)] });
    const content = document.createElement("div"), text = document.createTextNode("mounted"); content.append(text);
    const lastText = document.createTextNode("last");
    if (lines) {
      const first = document.createElement("div"), last = document.createElement("div");
      first.className = last.className = "cm-line"; first.append(text); content.append(first);
      if (lines > 1) { last.append(lastText); content.append(last); }
    }
    const box = () => new DOMRect(20, 30, 500, 300);
    content.getBoundingClientRect = box;
    const readRects = vi.fn(() => [new DOMRect(35, 45, 100, 20)]);
    const range = { setStart() {}, setEnd() {}, getClientRects: readRects, intersectsNode: () => true, compareBoundaryPoints: () => 0,
      cloneRange: () => ({ setStart() {}, setEnd() {}, getClientRects: readRects }) };
    vi.spyOn(document, "createRange").mockReturnValue(range as unknown as Range);
    vi.spyOn(state.doc, "toString").mockImplementation(() => { throw new Error("selection must not materialize source"); });
    const domAtPos = vi.fn((position: number) => ({ node: lines > 1 && position >= 500 ? lastText : text, offset: 0 }));
    const view = { state, viewport: { from: 400, to: 600 }, dom: content, contentDOM: content, scrollDOM: content,
      scaleX: 1, scaleY: 1, textDirection: Direction.LTR, domAtPos } as unknown as EditorView;
    return { view, domAtPos, readRects };
  }

  it("measures only the mounted intersection of a million-character selection", () => {
    const { view, domAtPos, readRects } = fixture(EditorSelection.single(0, 999_999), "live", 1);
    expect(measureDocumentSelection(view)).toHaveLength(1);
    expect(domAtPos.mock.calls).toEqual([[400, 1], [600, -1]]);
    expect(readRects).toHaveBeenCalledTimes(1);
  });

  it("uses one browser range per visible selection and omits offscreen ranges", () => {
    const { view, domAtPos, readRects } = fixture(EditorSelection.create([
      EditorSelection.range(10, 20), EditorSelection.range(420, 430), EditorSelection.range(520, 530), EditorSelection.range(900, 950),
    ]), "live", 1);
    expect(measureDocumentSelection(view)).toHaveLength(1);
    expect(domAtPos.mock.calls).toEqual([[420, 1], [430, -1], [520, 1], [530, -1]]);
    expect(readRects).toHaveBeenCalledTimes(2);
  });

  it.each([1, 2])("measures each mounted text line the range crosses, not block boxes, for %s lines", lines => {
    const { view, domAtPos, readRects } = fixture(EditorSelection.single(0, 999_999), "live", lines);
    expect(measureDocumentSelection(view)).toHaveLength(1);
    expect(domAtPos.mock.calls).toEqual([[400, 1], [600, -1]]);
    expect(readRects).toHaveBeenCalledTimes(lines);
  });

  it.each(["source", "empty", "offscreen"] as const)("does no DOM work for %s", kind => {
    const { view, domAtPos, readRects } = fixture(EditorSelection.single(kind === "empty" ? 450 : 10, kind === "empty" ? 450 : 20),
      kind === "source" ? "source" : "live");
    expect(measureDocumentSelection(view)).toEqual([]);
    expect(domAtPos).not.toHaveBeenCalled(); expect(readRects).not.toHaveBeenCalled();
  });
});

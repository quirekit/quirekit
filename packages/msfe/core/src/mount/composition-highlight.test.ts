// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { EditorView } from "@quirekit/cm-view";
import { createMsfeEditor } from "../editor/create";

/** @param view - Mounted owner. @returns Visible selection-match highlights. */
function matches(view: EditorView): number {
  return view.contentDOM.querySelectorAll(".cm-selectionMatch").length;
}

it("keeps selection-match highlights fixed while native composition owns the line", () => {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMsfeEditor({ parent, mode: "live", markdown: "classic-editor 我们有" });
  const view = EditorView.findFromDOM(editor.element)!;
  try {
    view.dispatch({ selection: { anchor: 17 } });
    view.contentDOM.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }));
    // WebKit reports the marked preedit as the selection; it matches the "e" in "editor" on the same line.
    view.dispatch({ changes: { from: 17, insert: "e" }, selection: { anchor: 17, head: 18 } });
    expect(matches(view)).toBe(0);
    view.contentDOM.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "e" }));
    view.dispatch({ selection: { anchor: 17, head: 18 } });
    expect(matches(view)).toBe(1);
  } finally { editor.destroy(); parent.remove(); }
});

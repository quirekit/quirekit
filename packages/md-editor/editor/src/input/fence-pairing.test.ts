// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { EditorView, runScopeHandlers } from "@quirekit/cm-view";
import { createMdEditor } from "../editor";

/** @param view - Focused editor. @param text - Characters typed one keystroke at a time. */
function type(view: EditorView, text: string): void {
  for (const char of text) {
    const head = view.state.selection.main.head;
    view.dispatch({ changes: { from: head, insert: char }, selection: { anchor: head + 1 }, userEvent: "input.type" });
  }
}

it("keeps later blocks when a closing fence is typed over the paired one", async () => {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown: "text\n\n\n\n```\n123\n```\n\n::: note\nx\n:::\n" });
  const view = EditorView.findFromDOM(editor.element)!;
  try {
    view.focus(); view.dispatch({ selection: { anchor: 6 } });
    await new Promise(resolve => setTimeout(resolve, 0));
    // The view hides fences, so the paired opener comes with an empty body row holding the caret.
    type(view, "```67");
    expect(runScopeHandlers(view, new KeyboardEvent("keydown", { key: "Enter", keyCode: 13 }), "editor")).toBe(true);
    type(view, "```");
    expect(view.state.doc.toString()).toBe("text\n\n```\n67\n```\n\n```\n123\n```\n\n::: note\nx\n:::\n");
  } finally { editor.destroy(); parent.remove(); }
});

// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { EditorView } from "@quirekit/cm-view";
import { createMdEditor } from "../editor";

const doc = "- 对于 classic-editor，我们有 `@quirekit/classic-ai`（目前\n- \n- 用";

it.each([
  ["inside the text", doc.indexOf("我们") + 2],
  ["right before hidden code delimiters", doc.indexOf("`")],
  ["in an empty list item", doc.indexOf("\n- \n") + 3],
])("keeps the composing line's DOM in place (%s)", async (_name, anchor) => {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown: doc });
  const view = EditorView.findFromDOM(editor.element)!;
  try {
    view.focus(); view.dispatch({ selection: { anchor } });
    await new Promise(resolve => setTimeout(resolve, 0));
    view.contentDOM.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }));
    // WebKit writes the preedit into the focused text node, or behind a trailing
    // widget buffer when the line has no text, then reports it.
    const selection = document.getSelection()!;
    let node = selection.anchorNode!, offset = selection.anchorOffset;
    if (node.nodeType === 3) (node as Text).insertData(offset, "w");
    else {
      let next = node.childNodes[offset] ?? null;
      while (next && (next as HTMLElement).classList?.contains("cm-widgetBuffer")) next = next.nextSibling;
      const text = document.createTextNode("w"); node.insertBefore(text, next); node = text; offset = 0;
    }
    const line = node.parentElement!.closest(".cm-line")!, previous = node.previousSibling;
    const removed: Node[] = [];
    const observer = new MutationObserver(records => { for (const record of records) removed.push(...record.removedNodes); });
    observer.observe(line, { subtree: true, childList: true });
    selection.collapse(node, offset + 1);
    view.contentDOM.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertCompositionText", data: "w" }));
    view.observer.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    removed.push(...observer.takeRecords().flatMap(record => [...record.removedNodes]));
    observer.disconnect();
    expect(view.state.sliceDoc(anchor, anchor + 1)).toBe("w");
    // Replacing or moving DOM beside the preedit makes WebKit drop the composition.
    expect(removed).toEqual([]);
    expect(node.previousSibling).toBe(previous);
  } finally { editor.destroy(); parent.remove(); }
});

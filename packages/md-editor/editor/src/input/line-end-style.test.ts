// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { EditorView, runScopeHandlers } from "@quirekit/cm-view";
import { createMdEditor } from "../editor";

it("leaves a link that ends its paragraph intact when Enter or typing follows the line end", async () => {
  const parent = document.createElement("div"); document.body.append(parent);
  const markdown = "text\n\n[参考](https://quirekit.com)";
  const editor = createMdEditor({ parent, markdown });
  const view = EditorView.findFromDOM(editor.element)!;
  try {
    view.focus(); view.dispatch({ selection: { anchor: markdown.indexOf("参") } });
    await new Promise(resolve => setTimeout(resolve, 0));
    // Native End and line-end clicks report the label end, before the hidden destination.
    view.dispatch({ selection: { anchor: markdown.indexOf("]") }, userEvent: "select" });
    expect(view.state.selection.main.head).toBe(markdown.length);
    expect(runScopeHandlers(view, new KeyboardEvent("keydown", { key: "Enter", keyCode: 13 }), "editor")).toBe(true);
    const head = view.state.selection.main.head;
    view.dispatch({ changes: { from: head, insert: "继续" }, selection: { anchor: head + 2 }, userEvent: "input.type" });
    expect(view.state.doc.toString()).toBe(`${markdown}\n\n继续`);
  } finally { editor.destroy(); parent.remove(); }
});

it("treats nested styles that end a paragraph as one line-end stop for Enter, typing and bold", async () => {
  const parent = document.createElement("div"); document.body.append(parent);
  const markdown = "text\n\n**[参考](https://quirekit.com)**";
  const editor = createMdEditor({ parent, markdown });
  const view = EditorView.findFromDOM(editor.element)!;
  try {
    view.focus(); view.dispatch({ selection: { anchor: markdown.indexOf("参") } });
    await new Promise(resolve => setTimeout(resolve, 0));
    view.dispatch({ selection: { anchor: markdown.indexOf("]") }, userEvent: "select" });
    expect(view.state.selection.main.head).toBe(markdown.length);
    expect(runScopeHandlers(view, new KeyboardEvent("keydown", { key: "Enter", keyCode: 13 }), "editor")).toBe(true);
    expect(view.state.doc.toString()).toBe(`${markdown}\n\n`);

    // Bold at the end of a line-closing italic stops for what follows instead of being removed.
    const styled = "text\n\n*说 **手感***";
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: styled }, selection: { anchor: styled.indexOf("感") + 1 } });
    expect(runScopeHandlers(view, new KeyboardEvent("keydown", { key: "b", keyCode: 66, ctrlKey: true }), "editor")).toBe(true);
    const head = view.state.selection.main.head;
    view.dispatch({ changes: { from: head, insert: "好" }, selection: { anchor: head + 1 }, userEvent: "input.type" });
    expect(view.state.doc.toString()).toBe(`${styled}好`);
  } finally { editor.destroy(); parent.remove(); }
});

// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { EditorView } from "@quirekit/cm-view";
import { createMdEditor } from "../editor";
import { linePlaceholders } from "./placeholder";

/** @param markdown - Source with one ¦ caret. @returns Hints on rendered rows. */
async function hints(markdown: string): Promise<string[]> {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown: markdown.replace("¦", ""), extensions: [{ id: "hints", extensions: linePlaceholders("输入 / 插入内容") }] });
  const view = EditorView.findFromDOM(editor.element)!;
  try {
    view.focus(); view.dispatch({ selection: { anchor: markdown.indexOf("¦") } });
    await new Promise(resolve => setTimeout(resolve, 0));
    return [...view.contentDOM.querySelectorAll(".md-line-placeholder")].map(line => line.getAttribute("data-placeholder")!);
  } finally { editor.destroy(); parent.remove(); }
}

it("names an empty heading's level and hints only at the empty paragraph holding the caret", async () => {
  expect(await hints("前文¦\n\n## \n\n后文")).toEqual(["H2"]);
  const focused = await hints("前文\n\n¦\n\n后文");
  expect(focused.length <= 1 && focused.every(text => text === "输入 / 插入内容")).toBe(true);
  expect(await hints("- 甲\n- ¦")).toEqual([]);
  expect(await hints("```js\n¦\n```")).toEqual([]);
});

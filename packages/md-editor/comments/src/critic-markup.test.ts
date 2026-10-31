// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection } from "@quirekit/cm-state";
import { createMsfeEditor, type MsfeEditor } from "@quirekit/msfe-core";
import { getComments } from "@quirekit/msfe-comments";
import { getMdCommentsBridge } from "@quirekit/md-editor/vue";
import { criticMarkupFor, readCriticMarkup, withCriticMarkup } from "./critic-markup";
import { mdCommentExtensions } from "./extension";
import type { MdCommentsOptions } from "./types";

const lin = { id: "lin", name: "小林" };
const editors: MsfeEditor[] = [];
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy(); document.body.replaceChildren(); });

/** @param markdown - Initial source. @param options - Comment configuration. @returns Mounted editor. */
function mount(markdown: string, options: MdCommentsOptions): MsfeEditor {
  const editor = createMsfeEditor({ parent: document.body.appendChild(document.createElement("div")), markdown,
    extensions: [...mdCommentExtensions(options, "评论", () => false)] });
  editors.push(editor);
  return editor;
}

/** @param editor - Editor. @returns Whether `MdEditor` offers the export with comment marks. */
const exportsReview = (editor: MsfeEditor): boolean => !!getMdCommentsBridge(editor)?.exportsReview();

describe("MD Editor CriticMarkup file actions", () => {
  it("stays out of the menu and the import path unless the host enables it", async () => {
    const editor = mount("正文。", { user: lin });
    expect(exportsReview(editor)).toBe(false);
    expect(criticMarkupFor(editor, "export")).toBeNull();
    expect(await readCriticMarkup(editor, "正文{>>批注<<}。", lin)).toBeNull();
    const exportOnly = mount("正文。", { user: lin, criticMarkup: { import: false } });
    expect(exportsReview(exportOnly)).toBe(true);
    expect(await readCriticMarkup(exportOnly, "正文{>>批注<<}。", lin)).toBeNull();
  });

  it("exports current comments as marks and merges imported marks after an append", async () => {
    const editor = mount("需要复核的段落。\n", { user: lin, criticMarkup: true });
    const comments = getComments(editor)!;
    editor.setSelection(EditorSelection.single(2, 4));
    comments.add({ body: "依据？" });
    expect(await withCriticMarkup(editor, editor.getMarkdown())).toBe("需要{==复核==}{>>@小林: 依据？<<}的段落。\n");
    const review = (await readCriticMarkup(editor, "补充{==一段==}{>>@小陈: 请确认<<}。\n", lin))!;
    expect(review).toMatchObject({ markdown: "补充一段。\n", count: 1 });
    // Appends the clean source as the file dialog does: one blank line after the existing text.
    expect(editor.run(state => ({ changes: { from: state.doc.length, insert: `\n${review.markdown}` } })).ok).toBe(true);
    review.merge();
    const source = editor.getMarkdown();
    expect(source).toBe("需要复核的段落。\n\n补充一段。\n");
    expect(comments.threads().map(view => [source.slice(view.range!.from, view.range!.to), view.thread.messages[0]!.author.name])).toEqual([["复核", "小林"], ["一段", "小陈"]]);
  });
});

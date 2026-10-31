// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@quirekit/cm-state";
import { createMsfeEditor, type MsfeEditor } from "@quirekit/msfe-core";
import { Comments, getComments } from "@quirekit/msfe-comments";
import { locateCommentThread } from "./bridge";

const editors: MsfeEditor[] = [];
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

describe("locateCommentThread", () => {
  it("finds threads through the installed comments and reports removed or orphaned ones", () => {
    const recorded = "# 标题\n\n第一段内容。第二句话。\n\n结尾段落。\n";
    let next = 0;
    const editor = createMsfeEditor({ parent: document.body.appendChild(document.createElement("div")), markdown: recorded, mode: "live",
      extensions: [Comments.configure({ user: { id: "a", name: "A" }, createId: () => `id-${++next}`, now: () => "2026-10-17T08:00:00.000Z" })] });
    editors.push(editor);
    const comments = getComments(editor)!, start = recorded.indexOf("结尾");
    editor.setSelection(EditorSelection.single(start, start + 2));
    expect(comments.add({ body: "?" })).toMatchObject({ ok: true, id: "id-1" });
    expect(locateCommentThread(editor.state, "id-1")).toEqual({ status: "exact", range: { from: start, to: start + 2 } });
    expect(locateCommentThread(editor.state, "gone")).toEqual({ status: "deleted" });
    expect(locateCommentThread(EditorState.create({ doc: recorded }), "id-1")).toEqual({ status: "unavailable" });
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection } from "@quirekit/cm-state";
import { componentView, createMsfeEditor, Extension, type MsfeEditor } from "@quirekit/msfe-core";
import type { CommentChange, CommentsOptions } from "../controller/types";
import type { CommentsController } from "../controller/controller";
import { getComments } from "./access";
import { Comments } from "./comments";

const editors: MsfeEditor[] = [];
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

const ALICE = { id: "alice", name: "Alice" }, BOB = { id: "bob", name: "Bob" };

/**
 * @param markdown - Initial source.
 * @param options - Comment options merged over a deterministic clock and id sequence.
 * @param readOnly - Source permission.
 * @returns Mounted editor, its controller and the recorded host changes.
 */
function mount(markdown: string, options: Partial<CommentsOptions> = {}, readOnly = false) {
  let next = 0;
  const changes: CommentChange[] = [];
  const editor = createMsfeEditor({ parent: document.body.appendChild(document.createElement("div")), markdown, mode: "live", readOnly,
    extensions: [Comments.configure({ user: ALICE, createId: () => `id-${++next}`, now: () => "2026-10-15T08:00:00.000Z",
      onChange: change => { changes.push(change); }, ...options })] });
  editors.push(editor);
  return { editor, comments: getComments(editor)!, changes };
}

/** @param editor - Editor. @param text - Unique text to select. */
function select(editor: MsfeEditor, text: string): void {
  const from = editor.state.doc.toString().indexOf(text);
  editor.setSelection(EditorSelection.single(from, from + text.length));
}

/** @param comments - Controller. @param id - Thread. @returns Current range text positions. */
const rangeOf = (comments: CommentsController, id: string) => comments.threads().find(view => view.thread.id === id)?.range;

describe("comments extension", () => {
  it("keeps repeated comment activation transaction-free", () => {
    const { editor, comments } = mount("Text with a comment");
    const created = comments.add({ body: "Review" }, { from: 0, to: 4 });
    if (!created.ok) throw new Error("Comment fixture failed");
    expect(comments.activate(created.id)).toBe(true);
    const active = editor.state;
    for (let index = 0; index < 5; index++) expect(comments.activate(created.id)).toBe(true);
    expect(editor.state).toBe(active);
    expect(comments.activate(null)).toBe(true);
    const inactive = editor.state;
    expect(comments.activate(null)).toBe(true); expect(editor.state).toBe(inactive);
  });
  it("creates, replies, edits, resolves and reports each operation without touching the Markdown", () => {
    const { editor, comments, changes } = mount("# 标题\n\n需要复核的段落。\n");
    select(editor, "复核");
    const created = comments.add({ body: "这里的**数据**来源？" });
    expect(created).toEqual({ ok: true, id: "id-1" });
    expect(editor.element.querySelector(".msfe-comment")?.textContent).toBe("复核");
    expect(comments.reply("id-1", { body: "见附录", mentions: [{ id: "bob", label: "Bob", url: "https://example.test/bob" }] })).toEqual({ ok: true, id: "id-3" });
    expect(comments.edit("id-1", "id-2", { body: "这里的数据来源？" }).ok).toBe(true);
    expect(comments.resolve("id-1").ok).toBe(true);
    expect(editor.element.querySelector(".msfe-comment")).toBeNull();
    const [view] = comments.threads();
    expect(view!.thread).toMatchObject({ resolved: true, resolvedBy: ALICE, messages: [
      { id: "id-2", parentId: null, body: "这里的数据来源？", editedAt: "2026-10-15T08:00:00.000Z" }, { id: "id-3", parentId: "id-2" }] });
    expect(changes.map(change => change.kind)).toEqual(["create", "reply", "edit", "resolve"]);
    expect(changes[0]!.snapshot().threads).toHaveLength(1);
    expect(editor.getMarkdown()).toBe("# 标题\n\n需要复核的段落。\n");
  });

  it("keeps document comments without a range, first in order, and writes version 2 only when they exist", () => {
    const { editor, comments, changes } = mount("开头。需要复核的句子。");
    select(editor, "复核"); comments.add({ body: "划词" });
    expect(comments.exportComments().version).toBe(1);
    expect(comments.addDocument({ body: "整篇的结构还要调整" })).toEqual({ ok: true, id: "id-3" });
    expect(comments.threads().map(view => [view.thread.id, view.status, view.range])).toEqual([["id-3", "document", null], ["id-1", "placed", { from: 5, to: 7 }]]);
    expect(comments.reply("id-3", { body: "同意" }).ok).toBe(true);
    expect(comments.reattach("id-3")).toEqual({ ok: false, reason: "invalid-range" });
    const exported = comments.exportComments();
    expect(exported.version).toBe(2);
    expect(exported.threads.find(thread => thread.id === "id-3")).not.toHaveProperty("anchor");
    const other = mount("全新的内容。").comments;
    expect(other.importComments(exported)).toMatchObject({ ok: true, orphaned: ["id-1"] });
    expect(other.threads().map(view => view.status)).toEqual(["document", "orphaned"]);
    expect(changes.map(change => change.kind)).toEqual(["create", "create", "reply"]);
    expect(editor.getMarkdown()).toBe("开头。需要复核的句子。");
  });

  it("follows edits and restores a deleted quote's range on undo, while comment operations stay out of undo", () => {
    const { editor, comments } = mount("开头。需要复核的句子。结尾。");
    select(editor, "复核的句子");
    comments.add({ body: "?" });
    editor.applyChanges({ documentId: editor.documentId, baseRevision: editor.revision, changes: { from: 0, insert: "新增 " } });
    expect(rangeOf(comments, "id-1")).toEqual({ from: 8, to: 13 });
    // A user edit that deletes the quote collapses the thread; undoing the edit brings the range back.
    const from = editor.state.doc.toString().indexOf("需要复核的句子");
    editor.chain().command(({ tr }) => tr.replace(from, from + 7, "")).run();
    expect(comments.threads()[0]).toMatchObject({ status: "detached", range: { from, to: from } });
    expect(editor.undo()).toBe(true);
    expect(rangeOf(comments, "id-1")).toEqual({ from: 8, to: 13 });
    expect(comments.threads()[0]!.status).toBe("placed");
    // Undo never removes the thread itself.
    expect(editor.undo()).toBe(false);
    expect(comments.threads()).toHaveLength(1);
  });

  it("lets a readonly source be commented and enforces user, author and host resolve rules", () => {
    const { editor, comments } = mount("正文内容", { canResolve: thread => thread.messages[0]!.author.id === BOB.id }, true);
    select(editor, "正文");
    expect(comments.add({ body: "只读也能评论" }).ok).toBe(true);
    expect(comments.add({ body: "   " })).toEqual({ ok: false, reason: "invalid-input" });
    expect(comments.threads()[0]!.resolvable).toBe(false);
    expect(comments.resolve("id-1")).toEqual({ ok: false, reason: "not-permitted" });
    expect(comments.reply("missing", { body: "x" })).toEqual({ ok: false, reason: "not-found" });
    const anonymous = mount("正文", { user: null }).comments;
    expect(anonymous.add({ body: "x" })).toEqual({ ok: false, reason: "no-user" });
    expect(mount("正文", { canComment: false }).comments.add({ body: "x" })).toEqual({ ok: false, reason: "not-permitted" });
  });

  it("creates on an explicit range captured earlier and reports write permission", () => {
    const { editor, comments } = mount("第一句。第二句。");
    expect(comments.writable()).toBe(true);
    editor.setSelection(EditorSelection.single(0));
    expect(comments.add({ body: "x" }, { from: 4, to: 7 }).ok).toBe(true);
    expect(rangeOf(comments, "id-1")).toEqual({ from: 4, to: 7 });
    expect(mount("x", { canComment: false }).comments.writable()).toBe(false);
  });

  it("deletes replies by re-parenting and threads by root author only", () => {
    const { comments } = mount("文本");
    comments.add({ body: "根" });
    comments.reply("id-1", { body: "回复" });
    expect(comments.remove("id-1", "id-3")).toEqual({ ok: true, id: "id-3" });
    expect(comments.threads()[0]!.thread.messages.map(message => message.id)).toEqual(["id-2"]);
    expect(comments.remove("id-1")).toEqual({ ok: true, id: "id-1" });
    expect(comments.threads()).toEqual([]);
  });

  it("deletes other people's messages only when the host allows it, and never edits them", () => {
    /** @param canDelete - Host rule. @returns Controller holding one thread written by Bob. */
    const foreign = (canDelete?: CommentsOptions["canDelete"]) => {
      const { editor, comments } = mount("正文", canDelete ? { canDelete } : {});
      select(editor, "正文");
      comments.add({ body: "根" });
      const data = comments.exportComments();
      comments.importComments({ ...data, threads: data.threads.map(thread => ({ ...thread, messages: thread.messages.map(message => ({ ...message, author: BOB })) })) });
      return comments;
    };
    expect(foreign().remove("id-1")).toEqual({ ok: false, reason: "not-permitted" });
    const moderated = foreign(() => true);
    expect(moderated.edit("id-1", "id-2", { body: "改" })).toEqual({ ok: false, reason: "not-permitted" });
    expect(moderated.remove("id-1")).toEqual({ ok: true, id: "id-1" });
  });

  it("round-trips through the exchange format, reports moved and orphaned threads, and reattaches orphans", () => {
    const first = mount("第一段需要复核。\n\n第二段将被删除的句子。");
    select(first.editor, "需要复核");
    first.comments.add({ body: "一" });
    select(first.editor, "将被删除的句子");
    first.comments.add({ body: "二" });
    const exported = JSON.parse(JSON.stringify(first.comments.exportComments()));
    const second = mount("新的开头。\n\n第一段需要复核。\n\n第二段。");
    expect(second.comments.importComments(exported)).toEqual({ ok: true, moved: ["id-1"], orphaned: ["id-3"] });
    expect(second.comments.threads().map(view => view.status)).toEqual(["placed", "orphaned"]);
    expect(second.changes).toEqual([]);
    select(second.editor, "第二段");
    expect(second.comments.reattach("id-3").ok).toBe(true);
    expect(second.comments.threads().map(view => view.status)).toEqual(["placed", "placed"]);
    expect(second.changes.map(change => change.kind)).toEqual(["reattach"]);
    expect(second.comments.importComments({ format: "quirekit.comments", version: 9 })).toEqual({ ok: false, reason: "invalid",
      issues: [{ code: "unsupported-version", path: "/version" }] });
    expect(second.comments.threads()).toHaveLength(2);
  });

  it("keeps the original quote of a deleted range so a later import reports it orphaned", () => {
    const { editor, comments } = mount("保留。删除这句。保留。");
    select(editor, "删除这句");
    comments.add({ body: "x" });
    const from = editor.state.doc.toString().indexOf("删除这句");
    editor.chain().command(({ tr }) => tr.replace(from, from + 4, "")).run();
    const exported = comments.exportComments();
    expect(exported.threads[0]!.anchor!.quote.exact).toBe("删除这句");
    expect(mount(editor.state.doc.toString()).comments.importComments(exported)).toMatchObject({ ok: true, orphaned: ["id-1"] });
  });

  it("outlines a block component inside a comment and clears it once resolved", async () => {
    const box = Extension.create({ name: "box", addProjectionLayers: () => [{ key: "box", placement: "block", modes: ["source", "live", "locked"],
      /** @param input - Visible source. @returns The BOX line replaced by a component. */
      build(input) {
        const from = input.document.slice(0, input.document.length).indexOf("BOX");
        return from < 0 ? [] : [{ type: "replace", key: "box", from, to: from + 3, block: true,
          view: componentView<object>(mount => { mount.dom.textContent = "组件"; return { update() {}, destroy() {} }; }, {}) }];
      } }] });
    const editor = createMsfeEditor({ parent: document.body.appendChild(document.createElement("div")), markdown: "前文\nBOX\n后文", mode: "live",
      extensions: [box, Comments.configure({ user: ALICE, createId: () => "t" })] });
    editors.push(editor);
    const comments = getComments(editor)!;
    editor.setSelection(EditorSelection.single(0, editor.state.doc.length));
    comments.add({ body: "整段" });
    // A selection over the component reveals its source; move the caret away so it renders.
    editor.setSelection(EditorSelection.single(0));
    /** @returns The component's marker attribute after CodeMirror's measure cycle. */
    const marker = async () => { await new Promise(resolve => setTimeout(resolve, 50)); return editor.element.querySelector(".msfe-component-view")?.getAttribute("data-msfe-commented"); };
    expect(await marker()).toBe("");
    comments.activate("t");
    expect(await marker()).toBe("active");
    comments.resolve("t");
    expect(await marker()).toBeNull();
  });

  it("marks point comments and activates them from the marker", () => {
    const { editor, comments } = mount("前文后文");
    editor.setSelection(EditorSelection.single(2));
    comments.add({ body: "插入点" });
    const marker = editor.element.querySelector<HTMLButtonElement>(".msfe-comment-marker")!;
    expect(marker.getAttribute("aria-label")).toBe("Comment");
    marker.click();
    expect(comments.active()).toBe("id-1");
    expect(comments.threadsAt(2)).toEqual(["id-1"]);
  });
});

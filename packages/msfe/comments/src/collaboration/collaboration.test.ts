// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { EditorSelection } from "@quirekit/cm-state";
import { EditorView } from "@quirekit/cm-view";
import { createMsfeEditor, type MsfeEditor } from "@quirekit/msfe-core";
import { adoptCollaborationSession, Collaboration } from "@quirekit/msfe-collaboration";
import { getComments } from "../extension/access";
import { Comments } from "../extension/comments";
import type { CommentsController } from "../controller/controller";
import type { CommentPerson, CommentThread } from "../protocol/types";
import { CommentsCollaboration } from "./extension";
import { roomThreads, storedAnchor, writeThread } from "./room";

const dispose: (() => void)[] = [];
afterEach(() => { dispose.splice(0).reverse().forEach(fn => fn()); document.body.replaceChildren(); });

const ALICE = { id: "alice", name: "Alice" }, BOB = { id: "bob", name: "Bob" };

/** One client: its own replicas of the source and the comment room, and a mounted editor. */
interface Client {
  /** Source replica. */ readonly source: Y.Doc;
  /** Comment room replica. */ readonly room: Y.Doc;
  /** Mounted editor. */ readonly editor: MsfeEditor;
  /** Comment operations. */ readonly comments: CommentsController;
}

/**
 * @param seed - Shared initial source state.
 * @param user - Comment author.
 * @param options - Epoch, editor readOnly and an existing room replica.
 * @returns Mounted client.
 */
function client(seed: Uint8Array, user: CommentPerson, options: { epoch?: string; readOnly?: boolean; room?: Y.Doc } = {}): Client {
  const source = new Y.Doc(), room = options.room ?? new Y.Doc();
  Y.applyUpdate(source, seed);
  const session = adoptCollaborationSession({ document: source, manifest: { documentId: "doc", epoch: options.epoch ?? "one", permission: "write",
    sourceFormat: { bom: false, lineEnding: "\n" } } });
  let next = 0;
  const editor = createMsfeEditor({ parent: document.body.appendChild(document.createElement("div")), readOnly: options.readOnly ?? false, extensions: [
    Collaboration.configure({ session }), Comments.configure({ user, createId: () => `${user.id}-${++next}`, now: () => `2026-10-15T08:00:0${next % 10}.000Z` }),
    CommentsCollaboration.configure({ session, room })] });
  dispose.push(() => { editor.destroy(); void session.close({ mode: "discard" }); source.destroy(); room.destroy(); });
  return { source, room, editor, comments: getComments(editor)! };
}

/** @param markdown - Initial source. @returns Encoded seed shared by every client. */
function seed(markdown: string): Uint8Array {
  const doc = new Y.Doc(); doc.getText("source").insert(0, markdown);
  const update = Y.encodeStateAsUpdate(doc); doc.destroy(); return update;
}

/** @param from - Sender replica. @param to - Receiver replica. */
const deliver = (from: Y.Doc, to: Y.Doc) => Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)));

/** @param clients - Clients to converge, source first and then the room. */
function sync(...clients: Client[]): void {
  for (const key of ["source", "room"] as const) for (const from of clients) for (const to of clients) if (from !== to) deliver(from[key], to[key]);
}

/** @param editor - Editor. @param text - Unique text. */
function select(editor: MsfeEditor, text: string): void {
  const from = editor.state.doc.toString().indexOf(text);
  editor.setSelection(EditorSelection.single(from, from + text.length));
}

/** @param editor - Editor. @param from - Offset. @param to - End. @param insert - Replacement. */
function edit(editor: MsfeEditor, from: number, to: number, insert = ""): void {
  EditorView.findFromDOM(editor.element)!.dispatch({ changes: { from, to, insert }, userEvent: insert ? "input.type" : "delete" });
}

/** @param c - Client. @returns Thread ids with quoted text and reply bodies, in source order. */
function view(c: Client) {
  const source = c.editor.state.doc.toString();
  return c.comments.threads().map(item => ({ id: item.thread.id, text: item.range ? source.slice(item.range.from, item.range.to) : null,
    status: item.status, resolved: item.thread.resolved, bodies: item.thread.messages.map(message => message.body) }));
}

describe("comments collaboration room", () => {
  it("shares threads, keeps concurrent replies and never writes the source document", () => {
    const update = seed("开头。需要复核的句子。结尾。"), alice = client(update, ALICE), bob = client(update, BOB);
    let sourceWrites = 0;
    alice.source.on("update", () => { sourceWrites++; }); bob.source.on("update", () => { sourceWrites++; });
    select(alice.editor, "复核");
    expect(alice.comments.add({ body: "数据来源？" }).ok).toBe(true);
    sync(alice, bob);
    expect(view(bob)).toEqual([{ id: "alice-1", text: "复核", status: "placed", resolved: false, bodies: ["数据来源？"] }]);
    alice.comments.reply("alice-1", { body: "A 的补充" }); bob.comments.reply("alice-1", { body: "B 的回答" });
    sync(alice, bob);
    expect(view(alice)[0]!.bodies).toHaveLength(3);
    expect(view(bob)).toEqual(view(alice));
    bob.comments.resolve("alice-1"); sync(alice, bob);
    expect(view(alice)[0]!.resolved).toBe(true);
    expect(sourceWrites).toBe(0);
    expect(alice.editor.getMarkdown()).toBe("开头。需要复核的句子。结尾。");
  });

  it("shares document comments through the room without placing them", () => {
    const update = seed("正文。"), alice = client(update, ALICE), bob = client(update, BOB);
    expect(alice.comments.addDocument({ body: "整体再精简" }).ok).toBe(true);
    sync(alice, bob);
    expect(view(bob)).toEqual([{ id: "alice-1", text: null, status: "document", resolved: false, bodies: ["整体再精简"] }]);
    bob.comments.reply("alice-1", { body: "好" }); sync(alice, bob);
    expect(view(alice)[0]!.bodies).toEqual(["整体再精简", "好"]);
  });

  it("follows remote text edits locally without rewriting room anchors", () => {
    const update = seed("开头。需要复核的句子。"), alice = client(update, ALICE), bob = client(update, BOB);
    select(alice.editor, "复核"); alice.comments.add({ body: "?" }); sync(alice, bob);
    let roomWrites = 0;
    alice.room.on("update", () => { roomWrites++; }); bob.room.on("update", () => { roomWrites++; });
    edit(bob.editor, 0, 0, "新的前言。"); edit(alice.editor, alice.editor.state.doc.length, alice.editor.state.doc.length, "后记");
    sync(alice, bob);
    expect(view(alice)[0]!.text).toBe("复核"); expect(view(bob)[0]!.text).toBe("复核");
    expect(roomWrites).toBe(0);
  });

  it("waits for source text that reaches the room before it arrives", () => {
    const update = seed("第一段。"), alice = client(update, ALICE), bob = client(update, BOB);
    edit(alice.editor, 4, 4, "新加的结论。");
    select(alice.editor, "结论"); alice.comments.add({ body: "依据？" });
    deliver(alice.room, bob.room);
    expect(view(bob)).toEqual([]);
    deliver(alice.source, bob.source);
    expect(view(bob)).toEqual([{ id: "alice-1", text: "结论", status: "placed", resolved: false, bodies: ["依据？"] }]);
  });

  it("converges offline edits and comments from both sides", () => {
    const update = seed("甲段落。乙段落。丙段落。"), alice = client(update, ALICE), bob = client(update, BOB);
    select(alice.editor, "乙段落"); alice.comments.add({ body: "A" });
    edit(bob.editor, 0, 0, "序。"); select(bob.editor, "丙段落"); bob.comments.add({ body: "B" });
    edit(alice.editor, 0, 4);
    sync(alice, bob);
    expect(alice.editor.getMarkdown()).toBe(bob.editor.getMarkdown());
    expect(view(alice).map(item => item.text)).toEqual(["乙段落", "丙段落"]);
    expect(view(bob)).toEqual(view(alice));
  });

  it("repairs a deleted quote after undo and shares the repair", () => {
    const update = seed("开头。需要复核的句子。结尾。"), alice = client(update, ALICE), bob = client(update, BOB);
    select(alice.editor, "复核"); alice.comments.add({ body: "?" }); sync(alice, bob);
    const from = alice.editor.state.doc.toString().indexOf("需要");
    edit(alice.editor, from, from + "需要复核的句子".length); sync(alice, bob);
    expect(view(bob)[0]!.status).toBe("detached");
    expect(alice.editor.undo()).toBe(true);
    expect(view(alice)[0]).toMatchObject({ text: "复核", status: "placed" });
    sync(alice, bob);
    expect(view(bob)[0]).toMatchObject({ text: "复核", status: "placed" });
  });

  it("lets a read-only source participant comment through the room", () => {
    const update = seed("只读正文。"), alice = client(update, ALICE), bob = client(update, BOB, { readOnly: true });
    select(bob.editor, "正文"); expect(bob.comments.add({ body: "看过了" }).ok).toBe(true);
    sync(alice, bob);
    expect(view(alice)[0]).toMatchObject({ text: "正文", bodies: ["看过了"] });
  });

  it("writes host imports to the room and re-anchors endpoints of another epoch by quote", () => {
    const update = seed("开头。需要复核的句子。");
    const thread = { id: "t1", resolved: false, anchor: { quote: { exact: "复核", prefix: "开头。需要", suffix: "的句子。" }, hint: { from: 5, to: 7 },
      hash: "fnv1a64:0000000000000000", relative: { start: { tname: "source", assoc: 0, item: { client: 1, clock: 99 } }, end: { tname: "source", assoc: -1 }, epoch: "old" } },
    messages: [{ id: "m1", parentId: null, author: ALICE, createdAt: "2026-10-15T08:00:00.000Z", body: "旧评论" }] };
    const alice = client(update, ALICE, { epoch: "two" });
    expect(alice.comments.importComments({ format: "quirekit.comments", version: 1, source: { hash: "fnv1a64:0000000000000000" }, threads: [thread] }).ok).toBe(true);
    expect(storedAnchor(roomThreads(alice.room).get("t1"))?.relative?.epoch).toBe("two");
    // A room still holding endpoints of the previous epoch falls back to the quote and rewrites them.
    const stale = new Y.Doc();
    stale.transact(() => writeThread(roomThreads(stale), thread as CommentThread));
    const bob = client(update, BOB, { epoch: "two", room: stale });
    expect(view(bob)[0]).toMatchObject({ id: "t1", text: "复核", status: "placed", bodies: ["旧评论"] });
    expect(storedAnchor(roomThreads(stale).get("t1"))?.relative?.epoch).toBe("two");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { CommentThread, CommentThreadView } from "@quirekit/msfe-comments";
import { commentCardModel, commentListPresentation, commentRailFits } from "./model";

describe("commentListPresentation", () => {
  it("docks beside the document, and overlays only when the rail column is unavailable", () => {
    expect(commentListPresentation({ railAvailable: true, narrow: false, reading: false })).toBe("dock");
    expect(commentListPresentation({ railAvailable: false, narrow: false, reading: false })).toBe("drawer");
    expect(commentListPresentation({ railAvailable: true, narrow: false, reading: true })).toBe("drawer");
    expect(commentListPresentation({ railAvailable: false, narrow: true, reading: false })).toBe("sheet");
  });
});

const lin = { id: "lin", name: "小林" }, chen = { id: "chen", name: "小陈" };
const thread: CommentThread = {
  id: "t", resolved: false,
  anchor: { quote: { exact: "原文", prefix: "", suffix: "" }, hint: { from: 0, to: 2 }, hash: "fnv1a64:0000000000000000" },
  messages: [{ id: "a", parentId: null, author: chen, createdAt: "2026-10-15T08:00:00Z", body: "问" },
    { id: "b", parentId: "a", author: lin, createdAt: "2026-10-15T09:00:00Z", editedAt: "2026-10-15T09:01:00Z", body: "答" }],
};
/** @param status - Placement. @param exact - Quote. @returns Controller view. */
const view = (status: CommentThreadView["status"], exact = "原文"): CommentThreadView => ({
  thread: { ...thread, anchor: { ...thread.anchor!, quote: { ...thread.anchor!.quote, exact } } },
  range: status === "orphaned" ? null : { from: 0, to: status === "detached" ? 0 : 2 }, status, resolvable: true,
});

describe("comment card model", () => {
  it("binds host actions to the thread and its current lines, for the threads that offer them", () => {
    const run = vi.fn();
    const actions = [{ id: "send", label: "发送", icon: "send", visible: (item: CommentThreadView) => item.status !== "orphaned", run }];
    const card = commentCardModel(view("placed"), { user: lin, actions }, undefined, position => position + 1);
    expect(commentCardModel(view("orphaned"), { user: lin, actions }).actions).toEqual([]);
    expect(card.actions.map(({ id, label, icon }) => [id, label, icon])).toEqual([["send", "发送", "send"]]);
    card.actions[0]!.run();
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ status: "placed", startLine: 1, endLine: 3, thread: expect.objectContaining({ id: "t" }) }));
  });

  it("grants edit and delete only on the user's own messages and maps quote states", () => {
    const card = commentCardModel(view("placed"), { user: lin });
    expect(card.messages.map(message => [message.id, message.editable, message.deletable, message.edited])).toEqual([["a", false, false, false], ["b", true, true, true]]);
    expect(card.replyable).toBe(true);
    expect([view("detached"), view("orphaned"), view("placed", "")].map(item => commentCardModel(item, { user: lin }).quoteState)).toEqual(["deleted", "unavailable", "point"]);
    expect(commentCardModel(view("placed", "```mermaid\nflowchart LR\n  A --> B\n```"), { user: lin }).quote).toBe("mermaid: flowchart LR A --> B");
    const { anchor: _anchor, ...document } = thread;
    expect(commentCardModel({ thread: document, range: null, status: "document", resolvable: true }, { user: lin }, "全文评论"))
      .toMatchObject({ quote: "", quoteState: "point", quoteLabel: "全文评论" });
    expect(commentCardModel(view("placed"), { user: lin, canComment: false })).toMatchObject({ replyable: false, messages: [{ editable: false }, { editable: false }] });
  });

  it("lets the host allow deleting others' messages and supply avatars", () => {
    const card = commentCardModel(view("placed"), { user: lin, canDelete: () => true, avatar: person => person.id === "chen" ? "/chen.png" : undefined });
    expect(card.messages.map(message => [message.id, message.editable, message.deletable, message.author])).toEqual([
      ["a", false, true, { name: "小陈", avatar: "/chen.png" }], ["b", true, true, { name: "小林" }]]);
    expect(commentCardModel(view("placed"), { user: lin, canComment: false, canDelete: () => true }).messages[0]!.deletable).toBe(false);
  });

});

describe("commentRailFits", () => {
  it("uses the default width unless the host sets one", () => {
    expect([commentRailFits(1039), commentRailFits(1040)]).toEqual([false, true]);
    expect([commentRailFits(719, 720), commentRailFits(720, 720)]).toEqual([false, true]);
  });
});

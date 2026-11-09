import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { describe, expect, it } from "vitest";
import QuireLocaleProvider from "../locale-provider/locale-provider.vue";
import QuireCommentDraft from "./draft.vue";
import QuireCommentRail from "./rail.vue";
import QuireCommentThread from "./thread.vue";
import { formatCommentTime } from "./presentation";
import { mentionLink, mentionQuery, mentionsIn } from "./mentions";
import type { QuireKitCommentMessage } from "./types";

const root: QuireKitCommentMessage = { id: "r", author: { name: "陈思" }, time: "2026-10-15T09:20:00Z", body: "请确认发布时间。" };
const replies: QuireKitCommentMessage[] = [root, { id: "a", author: { name: "Ada Lovelace" }, time: "2026-10-15T09:30:00Z", body: "已确认。", edited: true }];

/** @param component - Component. @param props - Props. @param locale - UI language. @returns Server-rendered HTML. */
function render(component: object, props: Record<string, unknown>, locale = "zh-CN"): Promise<string> {
  return renderToString(createSSRApp({ render: () => h(QuireLocaleProvider, { locale }, () => h(component, props)) }));
}

describe("comment components", () => {
  it("collapses replies until the thread is active", async () => {
    const collapsed = await render(QuireCommentThread, { messages: replies, quote: "发布时间" });
    expect(collapsed).toContain("请确认发布时间。");
    expect(collapsed).not.toContain("已确认。");
    expect(collapsed).toContain("1 条回复");
    const active = await render(QuireCommentThread, { messages: replies, quote: "发布时间", active: true, replyable: true });
    expect(active).toContain("已确认。");
    expect(active).toContain("已编辑");
    expect(active).toContain('data-active="true"');
    expect(active).toContain('aria-label="回复"');
  });

  it("places host actions in the card header", async () => {
    const html = await renderToString(createSSRApp({ render: () => h(QuireLocaleProvider, { locale: "zh-CN" }, () => h(QuireCommentThread, { messages: [root], quote: "x" }, { actions: () => h("button", { "data-host-action": "" }) })) }));
    expect(html.indexOf("data-host-action")).toBeGreaterThan(html.indexOf("qk-comment-thread__actions"));
  });

  it("offers previous and next with the position only on the active card of a longer sequence", async () => {
    const active = await render(QuireCommentThread, { messages: [root], quote: "x", active: true, position: { index: 2, total: 5 } });
    expect(active).toContain('aria-label="上一条"');
    expect(active).toContain('aria-label="下一条"');
    expect(active).toContain("2 / 5");
    expect(active).toContain('aria-label="第 2 条，共 5 条"');
    expect(await render(QuireCommentThread, { messages: [root], quote: "x", position: { index: 2, total: 5 } })).not.toContain("下一条");
    expect(await render(QuireCommentThread, { messages: [root], quote: "x", active: true, position: { index: 1, total: 1 } })).not.toContain("下一条");
  });

  it("renders a plain thread as a flat row without the quote line, and a plain draft as a bare input", async () => {
    const plain = await render(QuireCommentThread, { messages: [root], quote: "x", quoteState: "none", variant: "plain" });
    expect(plain).toContain("qk-comment-thread--plain");
    expect(plain).not.toContain("qk-comment-thread__quote");
    const draft = await render(QuireCommentDraft, { variant: "plain", placeholder: "输入评论", autofocus: false });
    expect(draft).toContain("qk-comment-draft--plain");
    expect(draft).toContain('placeholder="输入评论"');
    expect(draft).not.toContain("qk-card");
  });

  it("names quote states and offers resolve only when allowed", async () => {
    const deleted = await render(QuireCommentThread, { messages: [root], quoteState: "deleted" }, "en");
    expect(deleted).toContain("Original text was deleted");
    expect(deleted).not.toContain('aria-label="Resolve"');
    const resolved = await render(QuireCommentThread, { messages: [root], quote: "x", resolved: true, resolvable: true }, "en");
    expect(resolved).toContain('aria-label="Reopen"');
    expect(resolved).toContain("Resolved");
    expect(await render(QuireCommentThread, { messages: [root], quoteState: "unavailable" })).toMatch(/<button[^>]*disabled[^>]*data-state="unavailable"|data-state="unavailable"[^>]*disabled/u);
  });

  it("renders the draft with its quote and a disabled submit until text is entered", async () => {
    const html = await render(QuireCommentDraft, { quote: "发布窗口", author: { name: "林舟" } });
    expect(html).toContain("发布窗口");
    expect(html).toContain("添加评论…");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?评论/u);
  });

  it("places rail items at their anchors before measurement", async () => {
    const html = await renderToString(createSSRApp({ render: () => h(QuireCommentRail, { items: [{ id: "a", anchorTop: 16 }, { id: "b", anchorTop: 40 }], height: 300 },
      { item: ({ item }: { item: { id: string } }) => h("span", item.id) }) }));
    expect(html).toContain("min-height:300px");
    expect(html).toContain("inset-block-start:16px");
    expect(html).toContain("inset-block-start:40px");
  });

  it("formats times compactly by distance from now", () => {
    const now = new Date("2026-10-15T12:00:00");
    expect(formatCommentTime("2026-10-15T09:05:00", "en", now)).toBe("09:05");
    expect(formatCommentTime("2026-09-02T09:05:00", "en", now)).toBe("9/2, 09:05");
    expect(formatCommentTime("2025-09-02T09:05:00", "en", now)).toBe("9/2/2025, 09:05");
    expect(formatCommentTime("not a date", "en", now)).toBe("not a date");
  });

  it("finds @ queries at the caret and writes the editor's portable mention link", () => {
    expect(mentionQuery("请 @小", 4)).toEqual({ start: 2, text: "小" });
    expect(mentionQuery("@", 1)).toEqual({ start: 0, text: "" });
    expect(mentionQuery("mail@example", 12)).toBeNull();
    expect(mentionQuery("[@林](x) ", 9)).toBeNull();
    const lin = { id: "lin", label: "林_舟", url: "https://example.test/u?a=1&b=<2>" };
    expect(mentionLink(lin)).toBe("[@林\\_舟](<https://example.test/u?a=1&amp;b=\\<2\\>>)");
    const chosen = new Map([[lin.url, lin], ["x", { id: "x", label: "X", url: "x" }]]);
    expect(mentionsIn(`看 ${mentionLink(lin)} 这里`, chosen)).toEqual([lin]);
  });

  it("lets hosts relabel missing quotes, render their own editor and own the reply draft", async () => {
    expect(await render(QuireCommentThread, { messages: [root], quoteState: "point", quoteLabel: "位置批注" })).toContain("位置批注");
    const html = await renderToString(createSSRApp({ render: () => h(QuireLocaleProvider, { locale: "zh-CN" }, () => h(QuireCommentThread,
      { messages: replies, active: true, replyable: true, editingId: "a", replyDraft: "草稿", replyOpen: true },
      { editor: ({ message }: { message: QuireKitCommentMessage }) => h("div", { "data-host-editor": message.id }) })) }));
    expect(html).toContain('data-host-editor="a"');
    expect(html).toContain("草稿");
    expect(html).toContain("取消");
  });

  it("shows a single message action as a button and several as a menu", async () => {
    const own = await render(QuireCommentThread, { messages: [root, { ...replies[1]!, editable: true }], active: true });
    expect(own).toContain('aria-label="编辑"');
    const both = await render(QuireCommentThread, { messages: [root, { ...replies[1]!, editable: true, deletable: true }], active: true });
    expect(both).not.toContain('aria-label="编辑"');
  });
});

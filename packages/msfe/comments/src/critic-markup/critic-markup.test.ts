import { describe, expect, it } from "vitest";
import { hashCommentSource } from "../anchoring/hash";
import { createCommentAnchor } from "../anchoring/quote";
import type { CommentsExchange, CommentThread } from "../protocol/types";
import { exportCriticMarkup } from "./export";
import { importCriticMarkup } from "./import";

const ALICE = { id: "alice", name: "Alice" }, BOB = { id: "bob", name: "Bob" };

/**
 * @param source - Markdown.
 * @param specs - Quoted text (first occurrence, or a point after `at`) and bodies by author.
 * @returns Exchange data anchored on the source.
 */
function exchange(source: string, specs: readonly { quote: string; point?: boolean; resolved?: boolean; messages: readonly [typeof ALICE, string][] }[]): CommentsExchange {
  const hash = hashCommentSource(source);
  const threads = specs.map((spec, index): CommentThread => {
    const from = source.indexOf(spec.quote), to = spec.point ? from : from + spec.quote.length;
    const root = `m${index}-0`;
    return { id: `t${index}`, anchor: createCommentAnchor(source, { from, to }, hash), resolved: spec.resolved ?? false,
      messages: spec.messages.map(([author, body], at) => ({ id: `m${index}-${at}`, parentId: at ? root : null, author, createdAt: "2026-10-15T08:00:00.000Z", body })) };
  });
  return { format: "quirekit.comments", version: 1, source: { hash }, threads };
}

let counter = 0;
const options = { author: { id: "host", name: "Host" }, createId: () => `id-${++counter}`, now: () => "2026-10-15T09:00:00.000Z" };

describe("CriticMarkup export", () => {
  it("writes highlights with signed replies and lone comments, leaving the source otherwise intact", () => {
    const source = "# 标题\n\n需要复核的段落。\n\n结尾。\n";
    const result = exportCriticMarkup(source, exchange(source, [
      { quote: "复核", messages: [[ALICE, "数据来源？"], [BOB, "见\n附录"]] },
      { quote: "结尾", point: true, messages: [[BOB, "这里补一句 <<} 结束"]] },
    ]));
    expect(result.markdown).toBe("# 标题\n\n需要{==复核==}{>>@Alice: 数据来源？<<}{>>@Bob: 见 附录<<}的段落。\n\n{>>@Bob: 这里补一句 << } 结束<<}结尾。\n");
    expect(result).toMatchObject({ written: ["t0", "t1"], degraded: [], skipped: [] });
  });

  it("never enters code or splits inline syntax, and reports what changed", () => {
    const source = "前文 **加粗的词** 后文 `code` 末尾。\n\n```js\nlet a = 1;\n```\n\n- 第一项\n- 第二项\n";
    const result = exportCriticMarkup(source, exchange(source, [
      { quote: "粗的词** 后", messages: [[ALICE, "跨越粗体"]] },
      { quote: "code", messages: [[ALICE, "行内代码"]] },
      { quote: "let a", messages: [[ALICE, "代码块"]] },
      { quote: "第一项\n- 第二", messages: [[ALICE, "跨行"]] },
      { quote: "末尾", resolved: true, messages: [[ALICE, "已解决"]] },
    ]));
    expect(result.markdown).toBe("前文 {==**加粗的词** 后==}{>>@Alice: 跨越粗体<<}文 `code`{>>@Alice: 行内代码<<} 末尾。\n\n"
      + "{>>@Alice: 代码块<<}\n\n```js\nlet a = 1;\n```\n\n- {>>@Alice: 跨行<<}第一项\n- 第二项\n");
    expect(result.degraded.map(item => item.id)).toEqual(["t1", "t2", "t3"]);
    expect(result.skipped).toEqual([{ id: "t4", reason: "resolved" }]);
  });

  it("keeps a block comment inside its blockquote", () => {
    const source = "> 引用\n>\n> ```\n> x\n> ```\n";
    const result = exportCriticMarkup(source, exchange(source, [{ quote: "x", messages: [[ALICE, "看这里"]] }]));
    expect(result.markdown).toBe("> 引用\n>\n> {>>@Alice: 看这里<<}\n> \n> ```\n> x\n> ```\n");
    expect(importCriticMarkup(result.markdown, options).markdown).toBe(source);
  });
});

describe("CriticMarkup document comments", () => {
  it("writes document comments as trailing paragraphs and reads them back without an anchor", () => {
    const source = "正文第一段。\n\n结尾。\n";
    const data = exchange(source, [{ quote: "结尾", point: true, messages: [[ALICE, "点评论"]] }]);
    const document = { id: "doc", resolved: false, messages: [{ id: "d0", parentId: null, author: BOB, createdAt: "2026-10-15T08:00:00.000Z", body: "整体再精简" }] };
    const marked = exportCriticMarkup(source, { ...data, version: 2, threads: [...data.threads, document] }).markdown;
    expect(marked).toBe("正文第一段。\n\n{>>@Alice: 点评论<<}结尾。\n\n{>>@Bob: 整体再精简<<}\n");
    const result = importCriticMarkup(marked, { ...options, resolveAuthor: name => name === "Alice" ? ALICE : BOB });
    expect(result.markdown).toBe(source);
    expect(result.comments.version).toBe(2);
    expect(result.comments.threads.map(thread => [thread.anchor ? "anchored" : "document", thread.messages[0]!.body])).toEqual([["document", "整体再精简"], ["anchored", "点评论"]]);
    // A lone comment directly under text stays a point comment.
    expect(importCriticMarkup("段落\n{>>@Bob: 紧贴<<}\n", options).comments.threads[0]).toHaveProperty("anchor");
  });
});

describe("CriticMarkup import", () => {
  it("round-trips exported comments to the original source and anchors", () => {
    const source = "前文 **加粗的词** 后文。\n\n```js\nlet a = 1;\n```\n\n结尾。\n";
    const original = exchange(source, [
      { quote: "加粗的词", messages: [[ALICE, "说明"], [BOB, "同意"]] },
      { quote: "let a", messages: [[ALICE, "代码"]] },
      { quote: "结尾", point: true, messages: [[BOB, "点评论"]] },
    ]);
    const marked = exportCriticMarkup(source, original).markdown;
    const result = importCriticMarkup(marked, { ...options, resolveAuthor: name => name === "Alice" ? ALICE : BOB });
    expect(result.markdown).toBe(source);
    const view = result.comments.threads.map(thread => ({ text: source.slice(thread.anchor!.hint.from, thread.anchor!.hint.to),
      authors: thread.messages.map(message => message.author.id), bodies: thread.messages.map(message => message.body),
      replies: thread.messages.slice(1).every(message => message.parentId === thread.messages[0]!.id) }));
    expect(view).toEqual([
      { text: "加粗的词", authors: ["alice", "bob"], bodies: ["说明", "同意"], replies: true },
      { text: "", authors: ["alice"], bodies: ["代码"], replies: true },
      { text: "", authors: ["bob"], bodies: ["点评论"], replies: true },
    ]);
  });

  it("applies the suggestion policy, drops lone highlights and ignores marks inside code", () => {
    const source = "加{++入++}与{--删除--}和{~~旧~>新~~}，{==只高亮==}。`{>>代码<<}`\n\n```\n{==块==}{>>不识别<<}\n```\n{>>无署名<<}";
    expect(importCriticMarkup(source, { ...options, suggestions: "accept" })).toMatchObject({
      markdown: "加入与和新，只高亮。`{>>代码<<}`\n\n```\n{==块==}{>>不识别<<}\n```\n", highlights: 1, suggestions: 3 });
    expect(importCriticMarkup(source, { ...options, suggestions: "reject" }).markdown.startsWith("加与删除和旧，")).toBe(true);
    const kept = importCriticMarkup(source, options);
    expect(kept.markdown.startsWith("加{++入++}与{--删除--}和{~~旧~>新~~}，只高亮。")).toBe(true);
    expect(kept.comments.threads).toHaveLength(1);
    expect(kept.comments.threads[0]!.messages[0]).toMatchObject({ author: options.author, body: "无署名" });
  });
});

import { describe, expect, it } from "vitest";
import { hashCommentSource } from "./hash";
import { FUZZY_MAX_PAIRS, MAX_EXACT_CANDIDATES } from "./policy";
import { createCommentAnchor, createCommentQuote } from "./quote";
import { resolveCommentAnchor } from "./resolve";

/**
 * @param before - Source when the comment was written.
 * @param quote - Commented text.
 * @param occurrence - Which occurrence of `quote` was commented, zero-based.
 * @param after - Source to resolve against.
 * @returns Resolution plus the text it points at.
 */
function reanchor(before: string, quote: string, occurrence: number, after: string) {
  let from = -1;
  for (let count = 0; count <= occurrence; count++) from = before.indexOf(quote, from + 1);
  if (from < 0) throw new Error("fixture quote not found");
  const anchor = createCommentAnchor(before, { from, to: from + quote.length }, hashCommentSource(before));
  const result = resolveCommentAnchor(after, anchor, hashCommentSource(after));
  return { result, text: result.status === "resolved" ? after.slice(result.range.from, result.range.to) : null };
}

const ARTICLE = [
  "# 部署说明", "", "首先准备运行环境，安装 Node 22 与 pnpm。", "",
  "然后执行构建命令，确认产物目录中存在入口文件。", "", "最后把产物上传到静态服务器并刷新缓存。",
].join("\n");

describe("anchor re-anchoring", () => {
  it("uses the hint directly for the same source and for edits outside the context", () => {
    expect(reanchor(ARTICLE, "确认产物目录", 0, ARTICLE).result).toMatchObject({ status: "resolved", method: "hash" });
    const appended = reanchor(ARTICLE, "安装 Node 22", 0, `${ARTICLE}\n\n附录：常见问题。`);
    expect(appended.result).toMatchObject({ status: "resolved", method: "hint" });
    expect(appended.text).toBe("安装 Node 22");
  });

  it("follows text that moved, whether shifted by an edit or relocated with its paragraph", () => {
    const shifted = reanchor(ARTICLE, "确认产物目录", 0, ARTICLE.replace("# 部署说明", "# 生产环境部署说明（2026 版）"));
    expect(shifted.result).toMatchObject({ status: "resolved", method: "exact" });
    expect(shifted.text).toBe("确认产物目录");
    const lines = ARTICLE.split("\n");
    const moved = reanchor(ARTICLE, "上传到静态服务器", 0, [lines[0], "", lines[6], "", lines[2], "", lines[4]].join("\n"));
    expect(moved.text).toBe("上传到静态服务器");
  });

  it("uses context to pick the commented one of several identical quotes", () => {
    const table = "| 项目 | 状态 |\n| --- | --- |\n| 登录 | 待定 |\n| 支付 | 待定 |\n| 搜索 | 待定 |";
    const picked = reanchor(table, "待定", 1, `新增说明一行。\n\n${table}`);
    expect(picked.result).toMatchObject({ status: "resolved", method: "exact" });
    if (picked.result.status === "resolved") expect(picked.result.range.from).toBe(`新增说明一行。\n\n${table}`.indexOf("| 支付 | 待定") + 7);
  });

  it("orphans instead of guessing when identical blocks carry identical context", () => {
    const blocks = Array.from({ length: 5 }, () => "段落甲。需要复核的句子在这里。段落乙。").join("\n\n");
    expect(reanchor(blocks, "需要复核的句子", 2, `插入的开头。\n\n${blocks}`).result).toMatchObject({ status: "orphaned", reason: "ambiguous" });
  });

  it("orphans deleted text and short quotes whose only match lost its context", () => {
    expect(reanchor(ARTICLE, "刷新缓存", 0, ARTICLE.replace("并刷新缓存", "")).result).toMatchObject({ status: "orphaned", reason: "not-found" });
    expect(reanchor("选择：甲。理由：成本低。", "甲", 0, "结论改为：甲方案作废。").result).toMatchObject({ status: "orphaned", reason: "not-found" });
  });

  it("finds a rewritten quote and a re-wrapped paragraph approximately", () => {
    const quote = "执行构建命令，确认产物目录中存在入口文件";
    const rewritten = reanchor(ARTICLE, quote, 0, `前言。\n\n${ARTICLE.replace("确认产物目录中存在入口文件", "确认输出目录中存在入口文件")}`);
    expect(rewritten.result).toMatchObject({ status: "resolved", method: "fuzzy" });
    expect(rewritten.text).toBe("执行构建命令，确认输出目录中存在入口文件");
    const wrapped = "这是一段很长的说明文字，\n后面还有补充内容，用来解释配置项。";
    const joined = reanchor(wrapped, "很长的说明文字，\n后面还有补充内容", 0, wrapped.replace("，\n", "，"));
    expect(joined.result).toMatchObject({ status: "resolved", method: "fuzzy" });
    expect(joined.text).toBe("很长的说明文字，后面还有补充内容");
  });

  it("re-anchors point comments by the context on either side", () => {
    const source = "第一句话结束。第二句话开始。";
    const anchor = createCommentAnchor(source, { from: 7, to: 7 }, hashCommentSource(source));
    const edited = `新增的导语。${source}`;
    expect(resolveCommentAnchor(edited, anchor, hashCommentSource(edited))).toMatchObject({ status: "resolved", method: "exact", range: { from: 13, to: 13 } });
    // An unmoved point with fully agreeing context stays put even if the text is duplicated later.
    const doubled = `${source}\n${source}`;
    expect(resolveCommentAnchor(doubled, anchor, hashCommentSource(doubled))).toMatchObject({ status: "resolved", method: "hint", range: { from: 7 } });
    const shifted = `前${doubled}`;
    expect(resolveCommentAnchor(shifted, anchor, hashCommentSource(shifted))).toMatchObject({ status: "orphaned", reason: "ambiguous" });
  });

  it("keeps surrogate pairs whole and rejects ranges that split them", () => {
    const source = `${"😀".repeat(20)}评论${"😀".repeat(20)}`;
    const quote = createCommentQuote(source, { from: 40, to: 42 });
    expect(quote.prefix.length % 2).toBe(0);
    expect(quote.suffix.length % 2).toBe(0);
    expect(() => createCommentAnchor(source, { from: 1, to: 40 }, hashCommentSource(source))).toThrow("invalid-source-range");
  });

  it("bounds the work spent on repetitive text", () => {
    const repeated = "ab ".repeat(MAX_EXACT_CANDIDATES + 10);
    expect(reanchor(repeated, "ab", 3, `x${repeated}`).result).toEqual({ status: "orphaned", reason: "ambiguous", inspected: 0 });
    const noisy = `${"开头的一些句子。".repeat(10)}这一句话会被彻底改写掉。${"结尾的一些句子。".repeat(10)}`;
    const fuzzy = reanchor(noisy, "这一句话会被彻底改写掉。", 0, noisy.replace("这一句话会被彻底改写掉。", "完全不同的新内容出现了。"));
    expect(fuzzy.result.status).toBe("orphaned");
    expect(fuzzy.result.inspected).toBeLessThanOrEqual(FUZZY_MAX_PAIRS);
  });
});

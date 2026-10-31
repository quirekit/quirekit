import { describe, expect, it } from "vitest";
import type { QuireDocumentEvent, QuireDocumentPreview } from "../document-sdk/types";
import { createFakeSourceDocument, type FakeSourceDocument } from "./fixture.test-support";
import { createQuireAiSourceDocumentSdk, type QuireAiSourceDocumentSdkOptions } from "./sdk";

const sample = [
  "# 年度总结",
  "",
  "本季度的**核心指标**全部达成。",
  "",
  "- 牛奶",
  "  - 全脂",
  "- 鸡蛋",
  "",
  "结尾段落。"
].join("\n");

/** @param document - Port. @param options - SDK options. @returns SDK with a helper running one tool call. */
function setup(document: FakeSourceDocument, options: Partial<QuireAiSourceDocumentSdkOptions> = {}) {
  const sdk = createQuireAiSourceDocumentSdk(document, { documentId: "doc", ...options });
  let call = 0;
  const request = sdk.captureRequest();
  const run = async (toolName: string, input: unknown, requestId = request.id) =>
    (await sdk.invoke({ toolName, input, operationId: `op-${++call}`, requestId })).summary;
  return { sdk, request, run };
}

describe("source document view", () => {
  it("lists blocks with ids, nesting and the request context", async () => {
    const document = createFakeSourceDocument(sample);
    document.select(sample.indexOf("核心"), sample.indexOf("核心") + 4);
    const { sdk, request, run } = setup(document);
    expect(sdk.describeRequest(request.id)).toContain("Selected b2: \"核心指标\"");
    const view = await run("document_read", {});
    expect(view).toContain("## 正文\n[b1] # 年度总结\n[b2] 本季度的**核心指标**全部达成。\n[b3] - 牛奶\n  [b4] - 全脂\n[b5] - 鸡蛋\n[b6] 结尾段落。");
    expect(view).toContain("(6 of 6 blocks)");
  });

  it("abbreviates inline image data in the view", async () => {
    const document = createFakeSourceDocument(`![图标](data:image/png;base64,${"A".repeat(3000)})`);
    const { run } = setup(document);
    expect(await run("document_read", {})).toContain("[b1] ![图标](data:image/png;base64,…(3 KB))");
  });

  it("keeps ids of edited blocks and issues new ones for replaced blocks", async () => {
    const document = createFakeSourceDocument(sample);
    const { run } = setup(document);
    await run("document_read", {});
    const at = sample.indexOf("全部");
    document.edit([{ from: at, to: at, insert: "已经" }]);
    document.edit([{ from: 0, to: 0, insert: "新段落\n\n" }]);
    const view = await run("document_read", {});
    expect(view).toContain("[b7] 新段落\n[b1] # 年度总结\n[b2] 本季度的**核心指标**已经全部达成。");
  });
});

describe("source document edit", () => {
  it("applies a batch as one transaction, keeping separators and list indentation", async () => {
    const document = createFakeSourceDocument(sample);
    const { run } = setup(document);
    await run("document_read", {});
    const result = await run("document_edit", { operations: [
      { op: "replace", block: "b1", text: "## 年度回顾" },
      { op: "replace_text", block: "b2", find: "全部达成", replace: "大部分达成" },
      { op: "insert", after: "b4", blocks: ["- 脱脂"] },
      { op: "insert", after: "b2", blocks: ["新增说明。"] },
      { op: "append", block: "b6", text: "（完）" }
    ] });
    expect(result).toContain("Applied 5 operation(s).");
    expect(document.text()).toBe([
      "## 年度回顾", "", "本季度的**核心指标**大部分达成。", "", "新增说明。", "", "- 牛奶", "  - 全脂", "  - 脱脂", "- 鸡蛋", "", "结尾段落。（完）"
    ].join("\n"));
    expect(document.transactions).toBe(1);
  });

  it("deletes and moves blocks without breaking lists", async () => {
    const document = createFakeSourceDocument(sample);
    const { run } = setup(document);
    await run("document_read", {});
    await run("document_edit", { operations: [{ op: "delete", blocks: ["b5"] }, { op: "move", blocks: ["b6"], before: "b2" }] });
    expect(document.text()).toBe(["# 年度总结", "", "结尾段落。", "", "本季度的**核心指标**全部达成。", "", "- 牛奶", "  - 全脂"].join("\n"));
  });

  it("reports failures per operation and applies the rest", async () => {
    const document = createFakeSourceDocument(sample);
    const { run } = setup(document);
    await run("document_read", {});
    const result = await run("document_edit", { operations: [
      { op: "replace", block: "b3", text: "不是列表项" },
      { op: "replace_text", block: "b2", find: "不存在", replace: "x" },
      { op: "replace_all", find: "段落", replace: "部分" }
    ] });
    expect(result).toContain("Applied 1 of 3 operations.");
    expect(result).toContain("Operation 1 (replace): b3 is a list item");
    expect(result).toContain("Operation 2 (replace_text): \"不存在\" is not in b2");
    expect(document.text()).toContain("结尾部分。");
  });

  it("writes operations while the call is generated", async () => {
    const document = createFakeSourceDocument(sample);
    const { sdk, request, run } = setup(document);
    await run("document_read", {});
    const operations = [{ op: "replace_text", block: "b2", find: "本季度", replace: "今年" }, { op: "delete", blocks: ["b6"] }];
    sdk.observeInput({ toolName: "document_edit", input: { operations }, operationId: "stream", requestId: request.id });
    expect(document.text()).toContain("今年的");
    expect(document.text()).toContain("结尾段落");
    const result = await sdk.invoke({ toolName: "document_edit", input: { operations }, operationId: "stream", requestId: request.id });
    expect(result.summary).toContain("Applied 2 operation(s).");
    expect(document.text()).not.toContain("结尾段落");
    expect(document.transactions).toBe(2);
  });

  it("runs described commands with their targets", async () => {
    const document = createFakeSourceDocument(sample, {
      commands: {
        markImportant: {
          descriptor: { description: "Marks text as important.", target: "text", params: { type: "object", properties: {}, additionalProperties: false } },
          run: (text, _params, selection) => selection === undefined ? null : [{ from: selection.from, to: selection.to, insert: `==${text.slice(selection.from, selection.to)}==` }]
        }
      }
    });
    const { run } = setup(document);
    await run("document_read", {});
    const result = await run("document_edit", { operations: [{ op: "markImportant", block: "b6", text: "结尾" }, { op: "replace_text", block: "b6", find: "段落", replace: "一段" }] });
    expect(result).toContain("Applied 2 operation(s).");
    expect(document.text()).toContain("==结尾==一段。");
  });

  it("keeps the order of several inserts after the same block", async () => {
    const document = createFakeSourceDocument("甲。\n\n乙。");
    const { run } = setup(document);
    await run("document_read", {});
    await run("document_edit", { operations: [{ op: "insert", after: "b1", blocks: ["一"] }, { op: "insert", after: "b1", blocks: ["二"] }] });
    expect(document.text()).toBe("甲。\n\n一\n\n二\n\n乙。");
  });

  it("refuses writes to a read-only document", async () => {
    const document = createFakeSourceDocument(sample);
    document.setReadOnly(true);
    const { sdk } = setup(document);
    expect(sdk.tools().map(tool => tool.name)).toEqual(["document_read", "document_help"]);
  });
});

describe("source document review", () => {
  it("reviews a request and takes it back on rejection, keeping later user edits", async () => {
    const document = createFakeSourceDocument(sample);
    const { sdk, request, run } = setup(document, { authorizeWrite: () => ({ allowed: true, review: true }) });
    const events: QuireDocumentEvent[] = [];
    sdk.subscribe(event => events.push(event));
    await run("document_read", {});
    await run("document_edit", { operations: [{ op: "replace_text", block: "b2", find: "全部达成", replace: "超额完成" }, { op: "insert", at: "end", blocks: ["AI 补充。"] }] });
    expect(sdk.reviews.pending().inserted.length).toBe(2);
    const at = document.text().indexOf("年度总结");
    document.edit([{ from: at, to: at, insert: "用户" }]);
    expect(sdk.reviewRequest(request.id)).toBe(true);
    const preview = events.find((event): event is { type: "preview"; preview: QuireDocumentPreview } => event.type === "preview")!.preview;
    expect(preview.changes?.map(change => change.kind)).toEqual(["edited", "inserted"]);
    expect(sdk.decidePreview(preview.id, "rejected")).toBe(true);
    expect(document.text()).toBe(sample.replace("年度总结", "用户年度总结"));
    expect(sdk.reviews.pending().inserted).toEqual([]);
  });

  it("rewrites ids in replies", async () => {
    const document = createFakeSourceDocument(sample);
    const { sdk, run } = setup(document);
    await run("document_read", {});
    expect(sdk.presentReply("已修改 b2 和 b4。", "zh")).toBe("已修改 第 2 段 和 “- 全脂”。");
  });
});

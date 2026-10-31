// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createMsfeEditor, type MsfeChangeEvent, type MsfeEditor } from "@quirekit/msfe-core";
import { StarterKit } from "@quirekit/msfe-starter-kit";
import type { QuireDocumentEvent, QuireDocumentPreview } from "@quirekit/ai-runtime";
import { MsfeAi } from "./extension";
import { createMsfeAiDocument } from "./document";
import { createMsfeDocumentSdk } from "./sdk";

const editors: MsfeEditor[] = [];
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

/** @param markdown - Initial source. @returns Mounted editor with the AI extension. */
function mount(markdown: string): MsfeEditor {
  const parent = document.createElement("div");
  document.body.append(parent);
  const editor = createMsfeEditor({ parent, markdown, extensions: [StarterKit, MsfeAi] });
  editors.push(editor);
  return editor;
}

const sample = [
  "# 年度总结", "", "本季度的**核心指标**全部达成。", "", "- 牛奶", "  - 全脂", "- 鸡蛋", "",
  "```ts", "const total = 1;", "```", "", "| 姓名 | 部门 |", "| --- | --- |", "| 张三 | 研发 |"
].join("\n");

describe("MSFE source document port", () => {
  it("segments Markdown into the blocks the AI core lists", () => {
    const port = createMsfeAiDocument(mount(sample));
    expect(port.blocks().map(block => [block.kind, block.depth, port.text().slice(block.from, block.to)])).toEqual([
      ["heading", 0, "# 年度总结"],
      ["paragraph", 0, "本季度的**核心指标**全部达成。"],
      ["list-item", 0, "- 牛奶"],
      ["list-item", 1, "- 全脂"],
      ["list-item", 0, "- 鸡蛋"],
      ["code", 0, "```ts\nconst total = 1;\n```"],
      ["table", 0, "| 姓名 | 部门 |\n| --- | --- |\n| 张三 | 研发 |"]
    ]);
  });

  it("writes an edit as one undoable agent transaction and takes a rejected request back", async () => {
    const editor = mount(sample);
    const origins: string[] = [];
    editor.onChange((event: MsfeChangeEvent) => origins.push(event.origin));
    const sdk = createMsfeDocumentSdk(editor, { documentId: "doc", authorizeWrite: () => ({ allowed: true, review: true }) });
    const events: QuireDocumentEvent[] = [];
    sdk.subscribe(event => events.push(event));
    const request = sdk.captureRequest();
    const view = await sdk.invoke({ toolName: "document_read", input: {}, operationId: "read", requestId: request.id });
    expect(view.summary).toContain("[b3] - 牛奶\n  [b4] - 全脂");
    const result = await sdk.invoke({ toolName: "document_edit", operationId: "edit", requestId: request.id, input: { operations: [
      { op: "replace_text", block: "b2", find: "全部达成", replace: "超额完成" },
      { op: "insert", after: "b4", blocks: ["- 脱脂"] }
    ] } });
    expect(result.summary).toContain("Applied 2 operation(s).");
    expect(editor.getMarkdown()).toContain("超额完成");
    expect(editor.getMarkdown()).toContain("  - 全脂\n  - 脱脂\n- 鸡蛋");
    expect(origins).toEqual(["agent"]);
    expect(sdk.reviewRequest(request.id)).toBe(true);
    const preview = events.find((event): event is { type: "preview"; preview: QuireDocumentPreview } => event.type === "preview")!.preview;
    sdk.decidePreview(preview.id, "rejected");
    expect(editor.getMarkdown()).toBe(sample);
    expect(editor.undo()).toBe(true);
    expect(editor.getMarkdown()).toContain("超额完成");
    sdk.destroy();
  });
});

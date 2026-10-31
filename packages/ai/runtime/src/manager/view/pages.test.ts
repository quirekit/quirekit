import { Editor, Node } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import type { QuireAiLayoutPort } from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({ name: "paragraph", group: "block", content: "inline*" });
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });

/**
 * @param layout - Optional pagination port.
 * @returns View text of a body with paragraphs 甲 乙 丙 at positions 1, 4 and 7.
 */
async function read(layout?: QuireAiLayoutPort): Promise<string> {
  const editor = new Editor({ extensions: [doc, body, paragraph, text], content: { type: "doc", content: [{ type: "body", content: ["甲", "乙", "丙"].map(value => ({ type: "paragraph", content: [{ type: "text", text: value }] })) }] } });
  const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }), ...(layout === undefined ? {} : { layout }) });
  return String(((await sdk.invoke({ requestId: sdk.captureRequest().id, operationId: "read", toolName: "document_read", input: {} })).value as { text: string }).text);
}

describe("page breaks in the document view", () => {
  it("shows the page count and where each page begins, noting an underused page before it", async () => {
    const view = await read({ pages: () => [{ from: 1, to: 7, used: 0.5 }, { from: 7, to: 10, used: 0.3 }] });
    expect(view).toBe(["## 文档设置", "页数：2", "## 正文", "[b1] 甲", "[b2] 乙", "—— 第 2 页（上页正文只用了 50%）——", "[b3] 丙"].join("\n"));
  });

  it("leaves a well-used page's break plain and the view unchanged without a layout", async () => {
    expect(await read({ pages: () => [{ from: 1, to: 7, used: 0.95 }, { from: 7, to: 10, used: null }] })).toContain("—— 第 2 页 ——\n[b3] 丙");
    expect(await read()).toBe(["## 正文", "[b1] 甲", "[b2] 乙", "[b3] 丙"].join("\n"));
  });
});

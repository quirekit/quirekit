import { Editor, Node } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({ name: "paragraph", group: "block", content: "inline*" });
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });

describe("document_edit result view", () => {
  it("lists the blocks around the first change instead of the start of a long document", async () => {
    const editor = new Editor({ extensions: [doc, body, paragraph, text], content: { type: "doc", content: [{ type: "body", content:
      Array.from({ length: 150 }, (_, index) => ({ type: "paragraph", content: [{ type: "text", text: `段${index + 1}` }] })) }] } });
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;
    const result = await sdk.invoke({ requestId, operationId: "edit", toolName: "document_edit", input: { operations: [{ op: "insert", after: "b140", blocks: ["新段"] }] } });
    expect(result.summary).toContain("[b138] 段138");
    expect(result.summary).toMatch(/\[b151\] 新段/u);
    expect(result.summary).not.toContain("[b1] 段1\n");
    expect(result.summary).toContain("starting just before the first change");
  });
});

describe("selection after an edit", () => {
  it("keeps a caret a caret when the text around it is replaced", async () => {
    const editor = new Editor({ extensions: [doc, body, paragraph, text], content: { type: "doc", content: [{ type: "body", content: [
      { type: "paragraph", content: [{ type: "text", text: "原来的第一段" }] }, { type: "paragraph", content: [{ type: "text", text: "第二段" }] }
    ] }] } });
    editor.commands.setTextSelection(4);
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;
    await sdk.invoke({ requestId, operationId: "r", toolName: "document_edit", input: { operations: [
      { op: "delete", blocks: ["b1", "b2"] }, { op: "insert", at: "start", blocks: ["全新的一段很长的内容", "又一段"] }
    ] } });
    expect(editor.state.pm.selection.empty).toBe(true);
  });
});

import { Editor, Node, type QuireEditor } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({
  name: "paragraph", group: "block", content: "inline*",
  // A format whose command always refuses, to exercise failure reporting.
  addAiCapabilities: () => [{ kind: "format", name: "locked", level: "paragraph", description: "Never applies.",
    schema: { type: "boolean" }, read: () => undefined, apply: () => false }]
});
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });

/** @returns Editor with two body paragraphs b1–b2. */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, paragraph, text], content: { type: "doc", content: [{ type: "body", content: [
    { type: "paragraph", content: [{ type: "text", text: "旧标题" }] },
    { type: "paragraph", content: [{ type: "text", text: "旧正文" }] }
  ] }] } });
}

/** @param editor - Editor under test. @returns Texts of the body paragraphs. */
function bodyTexts(editor: QuireEditor): string[] {
  const texts: string[] = [];
  editor.state.doc.child(0).forEach(node => texts.push(node.textContent));
  return texts;
}

describe("whole-body replacement through document_edit", () => {
  it.each([
    ["delete first", [{ op: "delete", blocks: ["b1", "b2"] }, { op: "insert", at: "start", blocks: ["新标题", "新正文"] }]],
    ["insert first", [{ op: "insert", at: "end", blocks: ["新标题", "新正文"] }, { op: "delete", blocks: ["b1", "b2"] }]]
  ])("leaves exactly the new blocks (%s)", async (_label, operations) => {
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;

    await sdk.invoke({ requestId, operationId: "replace", toolName: "document_edit", input: { operations } });
    expect(bodyTexts(editor)).toEqual(["新标题", "新正文"]);
  });

  it("still clears the last block when nothing refills its container", async () => {
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;

    await sdk.invoke({ requestId, operationId: "clear", toolName: "document_edit", input: { operations: [{ op: "delete", blocks: ["b1", "b2"] }] } });
    expect(bodyTexts(editor)).toEqual([""]);
  });

  it("names the model operation that failed after deletes were moved behind inserts, and applies the rest", async () => {
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;

    const result = await sdk.invoke({ requestId, operationId: "fail", toolName: "document_edit", input: { operations: [
      { op: "delete", blocks: ["b1", "b2"] },
      { op: "insert", at: "start", blocks: [{ text: "新标题", format: { locked: true } }] }
    ] } });
    expect(result.summary).toContain("Applied 1 of 2 operations.");
    expect(result.summary).toContain("- Operation 2 (insert): could not be applied here");
    expect(bodyTexts(editor)).toEqual([""]);
  });
});

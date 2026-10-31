import { Editor, Node, type QuireEditor } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({
  name: "paragraph", group: "block", content: "inline*",
  addAiCapabilities: () => [{ kind: "format", name: "locked", level: "paragraph", description: "Never applies.",
    schema: { type: "boolean" }, read: () => undefined, apply: () => false },
  // Accepts the command but changes nothing, as a tracked change the revision system will not record.
  { kind: "format", name: "unrecorded", level: "paragraph", description: "Accepted but never recorded.",
    schema: { type: "boolean" }, read: () => undefined, apply: () => true }]
});
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });

/** @returns Editor with paragraphs 一 (b1) and 二 (b2). */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, paragraph, text], content: { type: "doc", content: [{ type: "body", content: [
    { type: "paragraph", content: [{ type: "text", text: "一" }] },
    { type: "paragraph", content: [{ type: "text", text: "二" }] }
  ] }] } });
}

/** @param editor - Editor. @returns Texts of the body paragraphs. */
function texts(editor: QuireEditor): string[] {
  const out: string[] = [];
  editor.state.doc.child(0).forEach(node => out.push(node.textContent));
  return out;
}

/** @returns Resolves once queued commits have run. */
async function settle(): Promise<void> {
  for (let index = 0; index < 5; index += 1) await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Streams growing `document_edit` arguments as a model generates them, then completes the call.
 * @param editor - Editor.
 * @param steps - Partial operation lists in generation order; the last is the complete call.
 * @param onStep - Inspects the document after each partial step.
 * @returns Tool result summary.
 */
async function stream(editor: QuireEditor, steps: readonly unknown[][], onStep: (index: number) => void = () => undefined): Promise<string> {
  const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
  const requestId = sdk.captureRequest().id;
  for (const [index, operations] of steps.entries()) {
    sdk.observeInput({ requestId, operationId: "edit", toolName: "document_edit", input: { operations } });
    await settle();
    onStep(index);
  }
  return (await sdk.invoke({ requestId, operationId: "edit", toolName: "document_edit", input: { operations: steps.at(-1) } })).summary;
}

describe("document_edit commits while its arguments stream", () => {
  it("writes each block of an insert once the next one starts, in order", async () => {
    const editor = createEditor();
    const seen: string[][] = [];
    await stream(editor, [
      [{ op: "insert", at: "start", blocks: ["A"] }],
      [{ op: "insert", at: "start", blocks: ["A", "B"] }],
      [{ op: "insert", at: "start", blocks: ["A", "B", "C"] }]
    ], () => seen.push(texts(editor)));
    expect(seen).toEqual([["一", "二"], ["A", "一", "二"], ["A", "B", "一", "二"]]);
    expect(texts(editor)).toEqual(["A", "B", "C", "一", "二"]);
  });

  it("continues after the blocks already written when inserting after a block", async () => {
    const editor = createEditor();
    await stream(editor, [
      [{ op: "insert", after: "b1", blocks: ["A", "B"] }],
      [{ op: "insert", after: "b1", blocks: ["A", "B", "C"] }]
    ]);
    expect(texts(editor)).toEqual(["一", "A", "B", "C", "二"]);
  });

  it("keeps the order when an insert closes because the next operation starts", async () => {
    const editor = createEditor();
    await stream(editor, [
      [{ op: "insert", at: "start", blocks: ["A", "B"] }],
      [{ op: "insert", at: "start", blocks: ["A", "B", "C"] }, { op: "replace", block: "b2", text: "改" }]
    ]);
    expect(texts(editor)).toEqual(["A", "B", "C", "一", "改"]);
  });

  it("keeps every block written before and after one that fails, and reports only that one", async () => {
    const editor = createEditor();
    const blocks = ["A", { text: "B", format: { locked: true } }, "C"];
    const summary = await stream(editor, [
      [{ op: "insert", at: "end", blocks: blocks.slice(0, 2) }],
      [{ op: "insert", at: "end", blocks }]
    ]);
    expect(texts(editor)).toEqual(["一", "二", "A", "C"]);
    expect(summary).toMatch(/Operation 1 \(insert\)/u);
  });

  it("writes a closed operation before the next one finishes, and keeps it when the call stops", async () => {
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;
    const controller = new AbortController();
    sdk.observeInput({ requestId, operationId: "edit", toolName: "document_edit", input: { operations: [
      { op: "replace", block: "b1", text: "改" }, { op: "insert", at: "end", blocks: ["写到一半"] }
    ] } }, { signal: controller.signal });
    await settle();
    controller.abort();
    expect(texts(editor)).toEqual(["改", "二"]);
  });

  it("holds back a delete that would empty the body until the new blocks are in", async () => {
    const editor = createEditor();
    await stream(editor, [
      [{ op: "delete", blocks: ["b1", "b2"] }, { op: "insert", at: "start", blocks: ["新"] }],
      [{ op: "delete", blocks: ["b1", "b2"] }, { op: "insert", at: "start", blocks: ["新", "内容"] }]
    ]);
    expect(texts(editor)).toEqual(["新", "内容"]);
  });

  it("reports content that tracked changes cannot record as left as it is, not as an error to retry", async () => {
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "tracked" }), trackedReviewer: { id: "ai", name: "AI" } });
    const requestId = sdk.captureRequest().id;
    const result = await sdk.invoke({ requestId, operationId: "edit", toolName: "document_edit", input: { operations: [
      { op: "format", blocks: ["b1"], set: { unrecorded: true } }, { op: "format", blocks: ["b2"], set: { unrecorded: true } }
    ] } });
    expect(result.summary).toMatch(/^Nothing was changed\. Left as they are — tracked changes cannot record these, so do not send them again/u);
    expect(result.summary).not.toContain("send only these again");
  });
});

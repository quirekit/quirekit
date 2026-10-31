import { defineCommand, Editor, Extension, Node, type CommandProps, type QuireCommandAgentContext, type QuireEditor } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({ name: "paragraph", group: "block", content: "inline*" });
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const story = Node.create({
  name: "story", content: "paragraph+", addAttributes: () => ({ kind: { default: "note" } }),
  addAiCapabilities: () => [{ kind: "structure", node: "story", role: "story", label: node => `Story（${String(node.attrs.kind)}）` }]
});
const store = Node.create({ name: "store", content: "story*", addAiCapabilities: () => [{ kind: "structure", node: "store", role: "store" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body store" });

const seen: QuireCommandAgentContext[] = [];
const annotations = Extension.create({
  name: "annotations",
  addAiCapabilities: () => [
    { kind: "story-label", node: "story", label: node => node.attrs.kind === "remark" ? "批注 1（张三）" : undefined }
  ],
  addCommands: () => ({
    mark_text: defineCommand({
      description: "Marks text.", target: "text", params: { type: "object" },
      adapt: (_params, context) => {
        seen.push(context);
        return context.range;
      },
      run: (range: { to: number }) => ({ tr }: CommandProps) => { tr.insertText("†", range.to); return true; }
    }),
    touch_block: defineCommand({
      description: "Touches the block.", target: "block", params: { type: "object" }, adapt: (_params, { pos }) => pos,
      run: (pos: number) => ({ tr }: CommandProps) => { tr.insertText("·", pos + 1); return true; }
    }),
    touch_document: defineCommand({ description: "Untargeted.", params: { type: "object" }, run: () => () => true }),
    decide: defineCommand({
      description: "Owns the transaction.", standalone: true, params: { type: "object" },
      run: () => ({ tr }: CommandProps) => { tr.insertText("✓", 2); return true; }
    })
  })
});

/** @returns Editor with one body paragraph and two stories. */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, store, story, paragraph, text, annotations], content: { type: "doc", content: [
    { type: "body", content: [{ type: "paragraph", content: [{ type: "text", text: "核心指标与核心风险" }] }] },
    { type: "store", content: [
      { type: "story", attrs: { kind: "remark" }, content: [{ type: "paragraph", content: [{ type: "text", text: "数据来源？" }] }] },
      { type: "story", attrs: { kind: "note" }, content: [{ type: "paragraph", content: [{ type: "text", text: "备注" }] }] }
    ] }
  ] } });
}

/**
 * @param editor - Editor under test.
 * @param preview - Whether the policy approves an edit before writing, so streamed operations are only previewed.
 * @returns SDK request whose context assigned ids, with the AI identity configured.
 */
function open(editor: QuireEditor, preview = false) {
  const sdk = getQuireAi(editor).createDocumentSdk({
    documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct", ...(preview ? { preview: "required" as const } : {}) }), trackedReviewer: { id: "ai", name: "QuireKit AI" }
  });
  const requestId = sdk.captureRequest().id;
  return { sdk, requestId };
}

describe("story labels and action targets", () => {
  it("titles feature-owned stories and falls back to the structure title", () => {
    const editor = createEditor();
    const { sdk, requestId } = open(editor);
    const view = String(sdk.describeRequest?.(requestId));
    expect(view).toContain("## 批注 1（张三）\n[b2] 数据来源？");
    expect(view).toContain("## Story（note）\n[b3] 备注");
  });

  it("selects the addressed text and hands the AI identity to the action", async () => {
    const editor = createEditor();
    const { sdk, requestId } = open(editor);
    seen.length = 0;

    await sdk.invoke({ requestId, operationId: "mark", toolName: "document_edit", input: { operations: [
      { op: "mark_text", block: "b1", text: "核心", occurrence: 2, params: {} }
    ] } });
    expect(editor.state.doc.child(0).textContent).toBe("核心指标与核心†风险");
    const applied = seen.at(-1)!;
    expect(applied.author).toEqual({ id: "ai", name: "QuireKit AI" });
    expect(applied.doc.textBetween(applied.range!.from, applied.range!.to)).toBe("核心");
  });

  it("addresses the whole block content when text is omitted", async () => {
    const editor = createEditor();
    const { sdk, requestId } = open(editor);
    seen.length = 0;

    await sdk.invoke({ requestId, operationId: "whole", toolName: "document_edit", input: { operations: [
      { op: "mark_text", block: "b1", params: {} }
    ] } });
    const applied = seen.at(-1)!;
    expect(applied.doc.textBetween(applied.range!.from, applied.range!.to)).toBe("核心指标与核心风险");
    expect(editor.state.doc.child(0).textContent).toBe("核心指标与核心风险†");
  });

  it("names the operation when the addressed text is missing", async () => {
    const editor = createEditor();
    const { sdk, requestId } = open(editor);

    await expect(sdk.invoke({ requestId, operationId: "missing", toolName: "document_edit", input: { operations: [
      { op: "mark_text", block: "b1", text: "营收", params: {} }
    ] } })).resolves.toMatchObject({ summary: expect.stringContaining("Operation 1 (mark_text): text \"营收\" is not in block b1") });
  });

  it("offers no block field for untargeted actions", async () => {
    const editor = createEditor();
    const { sdk } = open(editor);
    expect(sdk.tools().find(tool => tool.name === "document_edit")?.description).toMatch(/^- touch_document: params object — Untargeted\.$/mu);
    const help = await sdk.invoke({ requestId: sdk.captureRequest().id, operationId: "help", toolName: "document_help", input: { names: ["touch_document"] } });
    expect(help.summary).toContain("Operation touch_document (action): Untargeted.");
    expect(help.summary).not.toContain("block");
  });

  it("answers a malformed action with its expected fields and where to read them in full", async () => {
    const editor = createEditor();
    const { sdk, requestId } = open(editor);
    const result = sdk.invoke({ requestId, operationId: "bad", toolName: "document_edit", input: { operations: [{ op: "touch_document", params: {}, extra: 1 }] } });
    await expect(result).resolves.toMatchObject({ summary: expect.stringMatching(/Expected \{op: "touch_document"; params\?: object\}; document_help explains "touch_document" in full\./u) });
  });

  it("ignores a block given to an action that addresses no block", async () => {
    const editor = createEditor();
    const { sdk, requestId } = open(editor);
    const result = await sdk.invoke({ requestId, operationId: "doc", toolName: "document_edit", input: { operations: [{ op: "decide", block: "b1", text: "核心", params: {} }] } });
    expect(result.summary).toContain("Applied 1 operation(s).");
  });

  it("fails standalone actions alone when mixed with other changes", async () => {
    const editor = createEditor();
    const { sdk, requestId } = open(editor);
    const before = editor.state.doc;

    const mixed = await sdk.invoke({ requestId, operationId: "mixed", toolName: "document_edit", input: { operations: [
      { op: "replace_text", block: "b1", find: "核心", replace: "关键" },
      { op: "decide", params: {} }
    ] } });
    expect(mixed.summary).toContain("Applied 1 of 2 operations.");
    expect(mixed.summary).toContain("- Operation 2 (decide) must be in its own document_edit call");
    expect(editor.state.doc).not.toBe(before);
    expect(editor.state.doc.child(0).textContent).toBe("关键指标与核心风险");
    await sdk.invoke({ requestId, operationId: "alone", toolName: "document_edit", input: { operations: [
      { op: "decide", params: {} }, { op: "decide", params: {} }
    ] } });
  });

  it("previews text actions on the addressed text and block actions on the block's content", () => {
    const editor = createEditor();
    const manager = getQuireAi(editor);
    const { sdk, requestId } = open(editor, true);
    let controller = new AbortController();
    // A trailing partial operation closes the action, which streaming previews only once complete.
    const preview = (operation: unknown) => {
      controller.abort();
      controller = new AbortController();
      sdk.observeInput({ requestId, operationId: "preview", toolName: "document_edit", input: { operations: [operation, { op: "delete" }] } },
        { signal: controller.signal });
      const presentation = manager.previews.current!;
      const shown = presentation.steps.reduce((current, step) => step.apply(current).doc!, presentation.baseDoc);
      return presentation.ranges.map(range => ({ text: shown.textBetween(range.from, range.to), parent: shown.resolve(range.from).parent.type.name }));
    };

    expect(preview({ op: "mark_text", block: "b1", text: "核心", occurrence: 2, params: {} })).toEqual([{ text: "核心", parent: "paragraph" }]);
    expect(preview({ op: "touch_block", block: "b1", params: {} })).toEqual([{ text: "·核心指标与核心风险", parent: "paragraph" }]);
    controller.abort();
  });
});

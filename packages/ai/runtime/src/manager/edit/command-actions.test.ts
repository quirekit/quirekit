import { defineCommand, Editor, Extension, Node, type CommandProps, type QuireEditor } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({ name: "paragraph", group: "block", content: "inline*" });
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });

/** Commands of a feature, one described for Agents and one not. */
const marker = Extension.create({
  name: "marker",
  addCommands() {
    return {
      prefixParagraph: defineCommand({
        description: "Puts a marker before the text of the paragraph holding the selection.",
        target: "block",
        params: { type: "object", required: ["marker"], properties: { marker: { type: "string", minLength: 1 } }, additionalProperties: false },
        run: (options: { marker: string }) => ({ tr }: CommandProps) => {
          const $from = tr.selection.$from;
          tr.insertText(options.marker, $from.start());
          return true;
        }
      }),
      suffixParagraph: defineCommand({
        description: "Appends a suffix to paragraph number `number` of the body.",
        category: "测试",
        params: { type: "object", required: ["number", "suffix"], properties: { number: { type: "integer", minimum: 1 }, suffix: { type: "string" } }, additionalProperties: false },
        // Addresses a paragraph by number, as the view counts them, and turns it into a position.
        adapt: (params, context) => {
          const { number, suffix } = params as { number: number; suffix: string };
          let end: number | null = null;
          context.doc.child(0).forEach((child, offset, index) => { if (index === number - 1) end = offset + 1 + child.nodeSize; });
          return end === null ? null : { end, suffix };
        },
        satisfied: (params, context) => context.doc.textContent.includes((params as { suffix: string }).suffix),
        run: (options: { end: number; suffix: string }) => ({ tr }: CommandProps) => {
          if (tr.doc.textContent.includes(options.suffix)) return false;
          tr.insertText(options.suffix, options.end);
          return true;
        }
      }),
      clearParagraph: defineCommand({
        description: "Removes the text of the paragraph holding the selection.",
        target: "block",
        risk: "policy",
        run: () => ({ tr }: CommandProps) => {
          const $from = tr.selection.$from;
          tr.delete($from.start(), $from.end());
          return true;
        }
      }),
      internalOnly: () => () => true
    };
  }
});

/** @returns Editor with paragraphs 一 (b1) and 二 (b2). */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, paragraph, text, marker], content: { type: "doc", content: [{ type: "body", content: [
    { type: "paragraph", content: [{ type: "text", text: "一" }] }, { type: "paragraph", content: [{ type: "text", text: "二" }] }
  ] }] } });
}

describe("described editor commands as edit operations", () => {
  it("lists only described commands, explains them, and runs them on the addressed block", async () => {
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;
    const description = sdk.tools().find(tool => tool.name === "document_edit")!.description;
    expect(description).toMatch(/^- prefixParagraph \(block\): params \{marker: string\} — Puts a marker before the text/mu);
    expect(description).not.toContain("internalOnly");
    const help = await sdk.invoke({ requestId, operationId: "h", toolName: "document_help", input: { names: ["prefixParagraph"] } });
    expect(help.summary).toContain("Operation prefixParagraph (action (block)): Puts a marker");
    const result = await sdk.invoke({ requestId, operationId: "e", toolName: "document_edit", input: { operations: [
      { op: "prefixParagraph", block: "b2", params: { marker: "★" } }
    ] } });
    expect(result.summary).toContain("Applied 1 operation(s).");
    expect(editor.state.doc.child(0).child(1).textContent).toBe("★二");
  });

  it("passes a policy command's risk to the policy, which can hold the write for approval", async () => {
    const editor = createEditor();
    const risks: unknown[] = [];
    const decisions: ("approved" | "rejected")[] = ["rejected", "approved"];
    const sdk = getQuireAi(editor).createDocumentSdk({
      documentId: "d",
      authorizeWrite: request => { risks.push(request.risk); return request.risk === "policy" ? { allowed: true, mode: "direct", preview: "required" } : { allowed: true, mode: "direct" }; },
      requestPreview: async () => decisions.shift()!
    });
    const requestId = sdk.captureRequest().id;
    const edit = (operationId: string, operation: Record<string, unknown>) =>
      sdk.invoke({ requestId, operationId, toolName: "document_edit", input: { operations: [operation] } }).catch((error: Error) => ({ summary: error.message }));
    await edit("w", { op: "prefixParagraph", block: "b1", params: { marker: "★" } });
    expect(risks.at(-1)).toBe("write");
    const rejected = await edit("r", { op: "clearParagraph", block: "b2" });
    expect(risks.at(-1)).toBe("policy");
    expect(rejected.summary).toMatch(/reject/iu);
    expect(editor.state.doc.child(0).child(1).textContent).toBe("二");
    await edit("a", { op: "clearParagraph", block: "b2" });
    expect(editor.state.doc.child(0).child(1).textContent).toBe("");
  });

  it("reports wrong parameters for the model to correct", async () => {
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const result = await sdk.invoke({ requestId: sdk.captureRequest().id, operationId: "e", toolName: "document_edit", input: { operations: [
      { op: "prefixParagraph", block: "b1", params: {} }
    ] } });
    expect(result.summary).toMatch(/Operation 1 \(prefixParagraph\)/u);
    expect(editor.state.doc.textContent).toBe("一二");
  });

  it("adapts parameters with the document, lists groups, and counts a state already in place as done", async () => {
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;
    const description = sdk.tools().find(tool => tool.name === "document_edit")!.description;
    expect(description).toMatch(/^测试:\n- suffixParagraph: params/mu);
    const run = (params: unknown) => sdk.invoke({ requestId, operationId: `e-${Math.random()}`, toolName: "document_edit", input: { operations: [{ op: "suffixParagraph", params }] } });
    expect((await run({ number: 2, suffix: "！" })).summary).toContain("Applied 1 operation(s).");
    expect(editor.state.doc.textContent).toBe("一二！");
    expect((await run({ number: 2, suffix: "！" })).summary).not.toMatch(/Failed|No operation/u);
    expect((await run({ number: 5, suffix: "？" })).summary).toMatch(/Operation 1 \(suffixParagraph\)/u);
  });
});

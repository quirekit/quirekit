import { Editor, Mark, Node, type QuireEditor } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";

const text = Node.create({ name: "text", group: "inline" });
const bold = Mark.create({
  name: "bold",
  addAiCapabilities: () => [{
    kind: "format", name: "bold", level: "character", description: "Bold.", schema: { type: "boolean" },
    read: target => target.level === "character" && target.marks.some(mark => mark.type.name === "bold") ? true : undefined,
    apply: ({ tr, from, to }, value) => {
      const type = tr.doc.type.schema.marks.bold!;
      if (value === true) tr.addMark(from, to, type.create()); else tr.removeMark(from, to, type);
      return true;
    }
  }]
});
const size = Mark.create({
  name: "size", addAttributes: () => ({ value: { default: null } }),
  addAiCapabilities: () => [{
    kind: "format", name: "fontSize", level: "character", description: "Font size.", schema: { type: "string" },
    read: target => target.level === "character" ? target.marks.find(mark => mark.type.name === "size")?.attrs.value : undefined,
    apply: ({ tr, from, to }, value) => {
      const type = tr.doc.type.schema.marks.size!;
      tr.removeMark(from, to, type);
      if (typeof value === "string") tr.addMark(from, to, type.create({ value }));
      return true;
    }
  }]
});
const paragraph = Node.create({
  name: "paragraph", group: "block", content: "inline*", addAttributes: () => ({ align: { default: null }, id: { default: null } }),
  addAiCapabilities: () => [{
    kind: "format", name: "align", level: "paragraph", description: "Alignment.", schema: { type: "string" },
    read: target => target.level === "paragraph" ? target.node.attrs.align ?? undefined : undefined,
    apply: ({ tr, from }, value) => {
      tr.setNodeAttribute(from - 1, "align", value);
      return true;
    }
  }]
});
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });

/** @returns Editor whose first paragraph is centred, bold and 14pt throughout, with an identity attribute. */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, paragraph, text, bold, size], content: { type: "doc", content: [{ type: "body", content: [
    { type: "paragraph", attrs: { align: "center", id: "source-1" }, content: [
      { type: "text", text: "Annual ", marks: [{ type: "bold" }, { type: "size", attrs: { value: "14pt" } }] },
      { type: "text", text: "report", marks: [{ type: "bold" }, { type: "size", attrs: { value: "14pt" } }] }
    ] },
    { type: "paragraph", content: [{ type: "text", text: "Mixed " }, { type: "text", text: "bold", marks: [{ type: "bold" }] }] }
  ] }] } });
}

/**
 * Inserts after b1 with the given block.
 * @param editor - Editor.
 * @param block - New block spec.
 */
async function insert(editor: QuireEditor, block: unknown): Promise<void> {
  const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "like", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
  const requestId = sdk.captureRequest().id;
  await sdk.invoke({ requestId, operationId: `insert-${Math.random()}`, toolName: "document_edit", input: { operations: [{ op: "insert", after: "b1", blocks: [block] }] } });
}

/**
 * @param editor - Editor.
 * @returns The inserted second paragraph as JSON.
 */
function inserted(editor: QuireEditor) {
  return editor.getJSON().content![0]!.content![1]!;
}

describe("document_edit insert with like", () => {
  it("copies paragraph formats and whole-text character formats, but not other attributes", async () => {
    const editor = createEditor();
    await insert(editor, { text: "年度报告", like: "b1" });
    const block = inserted(editor);
    expect(block.attrs).toMatchObject({ align: "center", id: null });
    expect(block.content).toEqual([{ type: "text", text: "年度报告", marks: [{ type: "bold" }, { type: "size", attrs: { value: "14pt" } }] }]);
    editor.destroy();
  });

  it("lets format and inline markup override the copied formats", async () => {
    const editor = createEditor();
    await insert(editor, { text: "年度[报告]{fontSize:\"10pt\"}", like: "b1", format: { align: "left" } });
    const block = inserted(editor);
    expect(block.attrs?.align).toBe("left");
    expect(block.content?.at(-1)).toEqual({ type: "text", text: "报告", marks: [{ type: "bold" }, { type: "size", attrs: { value: "10pt" } }] });
    editor.destroy();
  });

  it("copies only character formats shared by the whole reference text", async () => {
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "like", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;
    await sdk.invoke({ requestId, operationId: "shared", toolName: "document_edit", input: { operations: [{ op: "insert", after: "b2", blocks: [{ text: "混合", like: "b2" }] }] } });
    expect(editor.getJSON().content![0]!.content![2]!.content).toEqual([{ type: "text", text: "混合" }]);
    editor.destroy();
  });
});

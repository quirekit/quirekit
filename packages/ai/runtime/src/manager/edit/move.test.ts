import { Editor, Node, type QuireEditor } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({ name: "paragraph", group: "block", content: "inline*", addAttributes: () => ({ tone: { default: null } }) });
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });

/** @returns Editor with body paragraphs 甲 乙 丙 丁 as b1–b4; 乙 carries an attribute. */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, paragraph, text], content: { type: "doc", content: [{ type: "body", content: [
    { type: "paragraph", content: [{ type: "text", text: "甲" }] },
    { type: "paragraph", attrs: { tone: "warm" }, content: [{ type: "text", text: "乙" }] },
    { type: "paragraph", content: [{ type: "text", text: "丙" }] },
    { type: "paragraph", content: [{ type: "text", text: "丁" }] }
  ] }] } });
}

/**
 * @param operations - Edit operations.
 * @returns Body texts after the edit and the edit summary.
 */
async function edit(operations: readonly unknown[]): Promise<{ texts: string[]; summary: string; editor: QuireEditor }> {
  const editor = createEditor();
  const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
  const result = await sdk.invoke({ requestId: sdk.captureRequest().id, operationId: "move", toolName: "document_edit", input: { operations } })
    .catch((error: Error) => ({ summary: error.message }));
  const texts: string[] = [];
  editor.state.doc.child(0).forEach(node => texts.push(node.textContent));
  return { texts, summary: result.summary, editor };
}

describe("moving blocks through document_edit", () => {
  it("moves adjacent blocks after a later block, keeping their attributes", async () => {
    const { texts, editor } = await edit([{ op: "move", blocks: ["b1", "b2"], after: "b4" }]);
    expect(texts).toEqual(["丙", "丁", "甲", "乙"]);
    expect(editor.state.doc.child(0).child(3).attrs.tone).toBe("warm");
  });

  it("moves a block before an earlier one and to the body start or end", async () => {
    expect((await edit([{ op: "move", blocks: ["b4"], before: "b2" }])).texts).toEqual(["甲", "丁", "乙", "丙"]);
    expect((await edit([{ op: "move", blocks: ["b3"], at: "start" }])).texts).toEqual(["丙", "甲", "乙", "丁"]);
    expect((await edit([{ op: "move", blocks: ["b1"], at: "end" }])).texts).toEqual(["乙", "丙", "丁", "甲"]);
  });

  it("refuses blocks apart from each other and a target inside the moved blocks", async () => {
    const apart = await edit([{ op: "move", blocks: ["b1", "b3"], at: "end" }]);
    expect(apart.summary).toMatch(/move adjacent blocks/u);
    expect(apart.texts).toEqual(["甲", "乙", "丙", "丁"]);
    const inside = await edit([{ op: "move", blocks: ["b1", "b2", "b3"], after: "b2" }]);
    expect(inside.summary).toMatch(/inside the moved blocks/u);
  });
});

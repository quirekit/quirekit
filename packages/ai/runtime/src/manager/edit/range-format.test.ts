import { Editor, Extension, Node } from "@quirekit/core";
import type {} from "@quirekit/ai-contract";
import { describe, expect, it } from "vitest";
import { getQuireAi } from "../manager";
import { compileQuireAiRegistry } from "../registry";

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({
  name: "paragraph", group: "block", content: "inline*",
  addAttributes: () => ({ start: { default: null }, tone: { default: null } }),
  addAiCapabilities: () => [{
    kind: "format", name: "start", level: "paragraph", description: "Starting value of the selected run.",
    schema: { type: "integer", minimum: 0 },
    read: target => target.level === "paragraph" ? target.node.attrs.start ?? undefined : undefined,
    satisfied: ({ doc, from }, value) => doc.nodeAt(from - 1)?.attrs.start === value,
    apply: ({ tr, from }, value) => {
      const position = from - 1;
      if (tr.doc.nodeAt(position)?.attrs.start !== value) tr.setNodeAttribute(position, "start", value);
      return true;
    }
  }, {
    kind: "format", name: "tone", level: "paragraph", description: "Value applied to every selected paragraph.",
    schema: { type: "integer", minimum: 0 },
    read: target => target.level === "paragraph" ? target.node.attrs.tone ?? undefined : undefined,
    apply: ({ tr, from, to }, value) => {
      tr.doc.nodesBetween(from, to, (node, position) => {
        if (!node.isTextblock) return true;
        if (node.attrs.tone !== value) tr.setNodeAttribute(position, "tone", value);
        return false;
      });
      return true;
    }
  }]
});
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });

describe("range format acceptance without a document change", () => {
  it("pairs the rule with the winning applier rather than another reader", () => {
    const satisfied = () => false;
    const reader = Extension.create({ name: "reader", addAiCapabilities: () => [{
      kind: "format", name: "start", level: "paragraph", description: "Read-only declaration.",
      read: () => undefined, satisfied: () => true
    }] });
    const lower = Extension.create({ name: "lower", addAiCapabilities: () => [{
      kind: "format", name: "start", level: "paragraph", description: "Lower-priority applier.",
      read: () => undefined, apply: () => true, applyPriority: -1, satisfied: () => true
    }] });
    const owner = Extension.create({ name: "owner", addAiCapabilities: () => [{
      kind: "format", name: "start", level: "paragraph", description: "Winning applier.",
      read: () => undefined, apply: () => true, satisfied
    }] });
    const registry = compileQuireAiRegistry([reader, lower, owner]);
    expect(registry.paragraphFormats[0]?.satisfied).toBe(satisfied);
  });

  it("keeps the default all-paragraph rule when only the first paragraph matches", async () => {
    const editor = new Editor({ extensions: [doc, body, paragraph, text], content: {
      type: "doc", content: [{ type: "body", content: [
        { type: "paragraph", attrs: { tone: 0 }, content: [{ type: "text", text: "first" }] },
        { type: "paragraph", content: [{ type: "text", text: "second" }] }
      ] }]
    } });
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "paragraphs", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;
    const input = { operations: [{ op: "format", blocks: ["b1", "b2"], set: { tone: 0 } }] };
    try {
      const first = await sdk.invoke({ requestId, operationId: "set", toolName: "document_edit", input });
      expect(first.summary).toMatch(/^Applied 1 operation/u);
      expect(editor.state.doc.child(0).content.content.map(node => node.attrs.tone)).toEqual([0, 0]);
      const before = editor.state.doc;
      const again = await sdk.invoke({ requestId, operationId: "repeat", toolName: "document_edit", input });
      expect(again.summary).toMatch(/^Nothing/u);
      expect(editor.state.doc).toBe(before);
    } finally { sdk.destroy(); editor.destroy(); }
  });

  it.each([0, 5])("keeps the owner-defined run semantics after setting %s to zero", async initial => {
    const editor = new Editor({ extensions: [doc, body, paragraph, text], content: {
      type: "doc", content: [{ type: "body", content: [
        { type: "paragraph", attrs: { start: initial }, content: [{ type: "text", text: "first" }] },
        { type: "paragraph", content: [{ type: "text", text: "second" }] }
      ] }]
    } });
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "range", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;
    const input = { operations: [{ op: "format", blocks: ["b1", "b2"], set: { start: 0 } }] };
    try {
      const first = await sdk.invoke({ requestId, operationId: "first", toolName: "document_edit", input });
      expect(first.summary).toMatch(initial === 0 ? /^Nothing/u : /^Applied 1 operation/u);
      const before = editor.state.doc;
      const second = await sdk.invoke({ requestId, operationId: "again", toolName: "document_edit", input });
      expect(second.summary).toMatch(/^Nothing/u);
      expect(editor.state.doc).toBe(before);
      expect(editor.state.doc.child(0).child(0).attrs.start).toBe(0);
      expect(editor.state.doc.child(0).child(1).attrs.start).toBeNull();
    } finally { sdk.destroy(); editor.destroy(); }
  });
});

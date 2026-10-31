import { defineCommand, Editor, Node, type CommandProps, type QuireEditor } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import type { QuireAiPicturePort } from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";

const prepared: unknown[] = [];
let calls = 0;
const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({
  name: "paragraph", group: "block", content: "inline*",
  addCommands: () => ({
    stamp: defineCommand({
      description: "Appends a prepared mark.", target: "block",
      params: { type: "object", properties: { mark: { type: "string" } }, required: ["mark"], additionalProperties: false },
      prepare: async (params, ports) => {
        calls += 1;
        const mark = (params as { mark: string }).mark;
        if (mark === "bad") throw new Error("mark bad is not in the catalog; use one of: ok.");
        return `${mark}:${(ports.pictures as QuireAiPicturePort | undefined)?.palettes()[0] ?? "none"}`;
      },
      adapt: (_params, { pos, prepared: value }) => {
        prepared.push(value);
        return pos === null ? null : { pos, value };
      },
      run: (options: { pos: number; value: unknown }) => ({ tr }: CommandProps) => { tr.insertText(String(options.value), options.pos + 1); return true; }
    })
  })
});
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });

/** @returns Editor with paragraphs 一 (b1) and 二 (b2). */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, paragraph, text], content: { type: "doc", content: [{ type: "body", content: [
    { type: "paragraph", content: [{ type: "text", text: "一" }] }, { type: "paragraph", content: [{ type: "text", text: "二" }] }
  ] }] } });
}

const pictures: QuireAiPicturePort = {
  list: () => [{ id: "avatar/a", category: "头像", description: "短发人物", aspect: 1 }],
  palettes: () => ["blue", "teal"],
  prepare: async () => ({ source: "media:1", intrinsicSize: { width: 1, height: 1 }, name: "a.png" })
};

describe("action preparation", () => {
  it("prepares each distinct action once with the host ports, hands the result to apply and fails a bad one alone", async () => {
    prepared.length = 0;
    calls = 0;
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }), pictures });
    const requestId = sdk.captureRequest().id;
    const result = await sdk.invoke({ requestId, operationId: "e", toolName: "document_edit", input: { operations: [
      { op: "stamp", block: "b1", params: { mark: "ok" } }, { op: "stamp", block: "b2", params: { mark: "ok" } },
      { op: "stamp", block: "b2", params: { mark: "bad" } }
    ] } });
    expect(calls).toBe(2);
    expect(new Set(prepared)).toEqual(new Set(["ok:blue"]));
    expect(editor.state.doc.textContent).toBe("ok:blue一ok:blue二");
    expect(result.summary).toContain("Operation 3 (stamp): mark bad is not in the catalog; use one of: ok.");
  });

  it("lists the host pictures under the name pictures", async () => {
    const sdk = getQuireAi(createEditor()).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }), pictures });
    const help = await sdk.invoke({ requestId: sdk.captureRequest().id, operationId: "h", toolName: "document_help", input: { names: ["pictures"] } });
    expect(help.summary).toBe("Pictures (write the id as `asset`; palettes: blue, teal, default blue; use one palette across a document):\n头像:\n- avatar/a (width:height 1): 短发人物");
  });
});

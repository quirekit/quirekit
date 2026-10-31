// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createMsfeEditor, type MsfeEditor } from "@quirekit/msfe-core";
import { StarterKit } from "@quirekit/msfe-starter-kit";
import { MsfeFlowchart, msfeFlowchartRenderPort } from "@quirekit/msfe-flowchart";
import { MsfeMindMap, msfeMindMapRenderPort } from "@quirekit/msfe-mind-map";
import { serializeFlowchart, type FlowchartDocument } from "@quirekit/flowchart";
import { serializeMindMap, type MindMapDocument } from "@quirekit/mind-map";
import { MsfeAi } from "./extension";
import { createMsfeDocumentSdk } from "./sdk";

const editors: MsfeEditor[] = [];
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

/** One-pixel PNG standing in for a rendered preview. */
const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const ports = {
  [msfeFlowchartRenderPort]: async (graph: FlowchartDocument) => ({ source: serializeFlowchart(graph), dataUrl: pixel, width: 1, height: 1 }),
  [msfeMindMapRenderPort]: async (mind: MindMapDocument) => ({ source: serializeMindMap(mind), dataUrl: pixel, width: 1, height: 1 })
};

/** @returns Editor with diagrams, the AI extension and an SDK with render ports. */
function setup() {
  const parent = document.body.appendChild(document.createElement("div"));
  const editor = createMsfeEditor({ parent, markdown: "报销流程如下。\n\n结尾。", extensions: [StarterKit, MsfeFlowchart, MsfeMindMap, MsfeAi] });
  editors.push(editor);
  const sdk = createMsfeDocumentSdk(editor, { documentId: "doc", ports });
  const request = sdk.captureRequest();
  let call = 0;
  const edit = async (operations: unknown[]) => (await sdk.invoke({ toolName: "document_edit", operationId: `op-${++call}`, requestId: request.id, input: { operations } })).summary;
  const read = async () => (await sdk.invoke({ toolName: "document_read", operationId: `op-${++call}`, requestId: request.id, input: {} })).summary;
  return { editor, sdk, edit, read };
}

describe("AI figures in MSFE", () => {
  it("inserts and updates a flowchart as one undo step each", async () => {
    const { editor, sdk, edit, read } = setup();
    expect(sdk.instructions()).toContain("Illustrated writing");
    await read();
    const inserted = await edit([{ op: "insertFlowchart", block: "b1", params: { title: "报销审批", nodes: [{ id: "submit", text: "提交" }, { id: "approve", text: "审批", shape: "decision" }], edges: [{ id: "e1", from: "submit", to: "approve" }] } }]);
    expect(inserted).toContain("Applied 1 operation(s).");
    const view = await read();
    const summary = /\[(b\d+)\] 流程图 (\{.*\})/u.exec(view)!;
    const block = summary[1]!;
    const flow = JSON.parse(summary[2]!) as { id: string; revision: number };
    expect(view).toContain("\"text\":\"审批\"");
    expect(editor.getMarkdown()).toMatch(/^报销流程如下。\n\n```quirekit-flowchart\n.+\n```\n\n结尾。$/su);
    const updated = await edit([{ op: "updateFlowchart", block, params: { id: flow.id, revision: flow.revision, nodes: [{ id: "finance", text: "财务复核" }], edges: [{ id: "e2", from: "approve", to: "finance" }] } }]);
    expect(updated).toContain("Applied 1 operation(s).");
    expect(await read()).toContain("财务复核");
    const stale = await edit([{ op: "updateFlowchart", block, params: { id: flow.id, revision: flow.revision, title: "旧版本" } }]);
    expect(stale).toContain("revision conflict");
    expect(editor.undo()).toBe(true);
    expect(await read()).not.toContain("财务复核");
  });

  it("inserts a mind map and refuses figures without a renderer", async () => {
    const { editor, edit, read } = setup();
    await read();
    expect(await edit([{ op: "insertMindMap", block: "b2", params: { root: "项目计划", topics: [{ id: "t1", text: "需求", parent: "root" }, { id: "t2", text: "排期", parent: "root" }] } }])).toContain("Applied 1 operation(s).");
    expect(await read()).toMatch(/思维导图 \{.*"text":"排期"/u);
    expect(editor.getMarkdown()).toContain("```quirekit-mind-map");
    const parent = document.body.appendChild(document.createElement("div"));
    const bare = createMsfeEditor({ parent, markdown: "段落。", extensions: [StarterKit, MsfeFlowchart, MsfeAi] });
    editors.push(bare);
    const sdk = createMsfeDocumentSdk(bare, { documentId: "bare" });
    const request = sdk.captureRequest();
    const result = await sdk.invoke({ toolName: "document_edit", operationId: "x", requestId: request.id, input: { operations: [{ op: "insertFlowchart", block: "b1", params: { nodes: [{ id: "a", text: "A" }] } }] } });
    expect(result.summary).toContain("the host provides no flowchart renderer");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { createEditor, type QuireEditor } from "@quirekit/core";
import { getQuireAi } from "@quirekit/ai-runtime";
import { StarterKit } from "@quirekit/starter-kit";
import { createWhiteboardDocument, editWhiteboardScene, readWhiteboardDocument, type WhiteboardSceneRenderer } from "@quirekit/whiteboard";
import { Whiteboard } from "../extension";
import { v4 as uuidv4 } from "uuid";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=";
const render: WhiteboardSceneRenderer = async scene => ({ scene, preview: { dataUrl: png, width: 1, height: 1 } });
const editors: QuireEditor[] = [];
/** @param renderer - Explicit resource preparation. @returns Independent editor and its central document SDK. */
function fixture(renderer = render) {
  const editor = createEditor({ extensions: [StarterKit, Whiteboard.configure({ renderScene: renderer })],
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "流程如下" }] }, { type: "paragraph", content: [{ type: "text", text: "保留结尾" }] }] } });
  editors.push(editor);
  const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "whiteboard-test", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
  return { editor, sdk };
}
afterEach(() => editors.splice(0).forEach(editor => editor.destroy()));

describe("whiteboard through the central model tools", () => {
  it("creates native editable nodes, reads labels/IDs, updates an existing board and undoes atomically", async () => {
    const { editor, sdk } = fixture();
    const requestId = sdk.captureRequest().id;
    const result = await sdk.invoke({ requestId, operationId: "create", toolName: "document_edit", input: { operations: [
      { op: "insertWhiteboard", block: "b1", params: { title: "审批流程", nodes: [{ id: "a", label: "申请" }, { id: "b", label: "审核" }], edges: [{ id: "ab", from: "a", to: "b" }] } },
    ] } });
    expect(result.summary).toContain("Applied 1 operation(s).");
    const board = readWhiteboardDocument(editor.getJSON().content![1]!.attrs!.board);
    expect(board.scene.elements).toEqual(expect.arrayContaining([expect.objectContaining({ id: "a", type: "rectangle" })]));
    const read = await sdk.invoke({ requestId, operationId: "read", toolName: "document_read", input: {} });
    const view = JSON.stringify(read.value);
    expect(view).toContain("申请"); expect(view).not.toContain("base64");
    const block = /\[(b\d+)\][^\n]*白板/u.exec(String((read.value as { text: string }).text))?.[1];
    expect(block).toBeTruthy();
    const before = editor.getJSON();
    const updated = await sdk.invoke({ requestId, operationId: "update", toolName: "document_edit", input: { operations: [
      { op: "updateWhiteboard", block, params: { id: board.id, revision: board.revision, nodes: [{ id: "b", label: "发布", x: 600 }] } },
    ] } });
    expect(updated.summary).toContain("Applied 1 operation(s).");
    expect(readWhiteboardDocument(editor.getJSON().content![1]!.attrs!.board).scene.elements).toEqual(expect.arrayContaining([expect.objectContaining({ id: "b:label", text: "发布" })]));
    expect(editor.commands.undo()).toBe(true); expect(editor.getJSON()).toEqual(before);
    expect(editor.state.doc.textContent).toBe("流程如下保留结尾");
  });

  it("rejects invalid connections and renderer failures without partial source writes", async () => {
    const { editor, sdk } = fixture(async () => { throw new Error("snapshot failed"); });
    const before = editor.getJSON();
    for (const params of [{ nodes: [{ id: "a" }], edges: [{ id: "e", from: "a", to: "missing" }] }, { nodes: [{ id: "a" }] }]) {
      const result = await sdk.invoke({ requestId: sdk.captureRequest().id, operationId: uuidv4(), toolName: "document_edit", input: { operations: [{ op: "insertWhiteboard", block: "b1", params }] } });
      expect(result.summary).not.toContain("Applied 1 operation(s)."); expect(editor.getJSON()).toEqual(before);
    }
  });

  it("rejects stale revisions instead of overwriting a changed whiteboard", async () => {
    const { editor, sdk } = fixture();
    const original = createWhiteboardDocument("existing");
    editor.commands.insertWhiteboard({ document: { ...original, scene: editWhiteboardScene(original.scene, { nodes: [{ id: "a", label: "原文" }] }) }, from: 6, to: 6 });
    const requestId = sdk.captureRequest().id;
    const read = await sdk.invoke({ requestId, operationId: "read", toolName: "document_read", input: {} });
    const block = /\[(b\d+)\][^\n]*白板/u.exec(String((read.value as { text: string }).text))?.[1];
    const before = editor.getJSON();
    const result = await sdk.invoke({ requestId, operationId: "stale", toolName: "document_edit", input: { operations: [{ op: "updateWhiteboard", block,
      params: { id: "existing", revision: 7, nodes: [{ id: "a", label: "错误" }] } }] } });
    expect(result.summary).not.toContain("Applied 1 operation(s)."); expect(editor.getJSON()).toEqual(before);
  });
});

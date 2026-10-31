import { Editor, Node } from "@quirekit/core";
import { expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";

const diagram = Node.create({ name: "diagram", group: "block", atom: true,
  addAiCapabilities: () => [{ kind: "block", node: "diagram", label: () => "Diagram",
    items: () => Array.from({ length: 85 }, (_, index) => ({ id: `n${index}`, label: index === 80 ? "最终验收" : `步骤 ${index}`, properties: { x: index * 10 } })) }]
});

it("bounds long rows, searches untruncated labels and refuses a deleted target", async () => {
  const large = diagram.extend({
    addAiCapabilities: () => [{ kind: "block", node: "diagram", label: () => "Large diagram", items: () => Array.from({ length: 100 }, (_, index) => ({ id: `n${index}`, label: "长文字".repeat(1000) + (index === 99 ? "末尾目标" : "") })) }]
  });
  const editor = new Editor({ extensions: [doc, text, large], content: { type: "doc", content: [{ type: "diagram" }, { type: "diagram" }] } });
  const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "large-items", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
  const requestId = sdk.captureRequest().id;
  const page = await sdk.invoke({ requestId, operationId: "page", toolName: "document_read", input: { items: { block: "b1", limit: 100 } } });
  expect(page.summary.length).toBeLessThanOrEqual(24_000); expect(page.summary).toContain('"truncated":true'); expect(page.summary).toContain("continue");
  const found = await sdk.invoke({ requestId, operationId: "find", toolName: "document_read", input: { items: { block: "b1", find: "末尾目标" } } });
  expect(found.summary).toContain('"n99"'); expect(found.summary).toContain("1 of 1");
  expect(editor.commands.deleteRange({ from: 0, to: 1 })).toBe(true);
  const deleted = await sdk.invoke({ requestId, operationId: "deleted", toolName: "document_read", input: { items: { block: "b1" } } });
  expect(deleted.summary).toContain("does not exist"); expect(deleted.summary).not.toContain('"n0"');
  sdk.destroy(); editor.destroy();
});
const doc = Node.create({ name: "doc", topNode: true, content: "block+" });
const text = Node.create({ name: "text", group: "inline" });

it("pages, finds and targets internal items without exposing another model tool", async () => {
  const editor = new Editor({ extensions: [doc, text, diagram], content: { type: "doc", content: [{ type: "diagram" }] } });
  const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "items", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
  const requestId = sdk.captureRequest().id;
  let operation = 0;
  /** @param input - Read query. @returns Guarded result. */
  const read = (input: Record<string, unknown>) => sdk.invoke({ requestId, operationId: `r${operation++}`, toolName: "document_read", input });
  expect((await read({})).summary).toContain("document_read.items");
  const first = await read({ items: { block: "b1", limit: 40 } });
  expect(first.summary).toContain('"n39"'); expect(first.summary).not.toContain('"n40"');
  expect(first.summary).toContain('"offset":40');
  const tail = await read({ items: { block: "b1", offset: 80 } });
  expect(tail.summary).toContain("最终验收"); expect(tail.summary).toContain("5 of 85");
  const found = await read({ items: { block: "b1", find: "最终验收" } });
  expect(found.summary).toContain('"n80"'); expect(found.summary).toContain("1 of 1");
  const exact = await read({ items: { block: "b1", ids: ["n84", "absent"] } });
  expect(exact.summary).toContain('"n84"'); expect(exact.summary).not.toContain('"n83"');
  expect((await read({ items: { block: "b999" } })).summary).toMatch(/does not exist/);
  expect((await read({ items: { block: "b1" }, find: "text" })).summary).toMatch(/combine/);
  sdk.destroy(); editor.destroy();
});

it("reads the items of an inline object another feature owns through its text block", async () => {
  const paragraph = Node.create({ name: "paragraph", group: "block", content: "inline*",
    addAiCapabilities: () => [{ kind: "block", node: "paragraph" }] });
  const figure = Node.create({ name: "figure", group: "inline", inline: true, atom: true,
    addAttributes: () => ({ board: { default: null } }),
    addAiCapabilities: () => [{ kind: "block", node: "figure", label: () => "图片" }] });
  const board = Node.create({ name: "boardOwner",
    addAiCapabilities: () => [{ kind: "block-label", node: "figure",
      label: node => node.attrs.board ? "白板" : undefined,
      items: node => node.attrs.board ? [{ id: "n1", label: "申请" }, { id: "n2", label: "审核" }] : undefined }] });
  const editor = new Editor({ extensions: [doc, text, paragraph, figure, board], content: { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "流程：" }, { type: "figure", attrs: { board: true } }] },
    { type: "paragraph", content: [{ type: "figure" }] }
  ] } });
  const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "inline-items", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
  const requestId = sdk.captureRequest().id;
  const view = await sdk.invoke({ requestId, operationId: "view", toolName: "document_read", input: {} });
  expect(view.summary).toContain('[b1] 流程：[白板] (internal items: document_read.items with block="b1")');
  expect(view.summary).toContain("[b2] [图片]");
  expect(view.summary).not.toContain('block="b2"');
  const items = await sdk.invoke({ requestId, operationId: "items", toolName: "document_read", input: { items: { block: "b1" } } });
  expect(items.summary).toContain('"n2"'); expect(items.summary).toContain("2 of 2");
  const none = await sdk.invoke({ requestId, operationId: "none", toolName: "document_read", input: { items: { block: "b2" } } });
  expect(none.summary).toContain("has no internal item reader");
  sdk.destroy(); editor.destroy();
});

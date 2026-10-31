import { Editor, Node, type QuireEditor } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";
import { describeQuireAiChanges } from "./changes";

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({ name: "paragraph", group: "block", content: "inline*" });
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });
const picture = Node.create({
  name: "picture", group: "inline", inline: true, atom: true,
  addAttributes: () => ({ src: { default: "" }, alt: { default: "" }, graphic: { default: null } }),
  addAiCapabilities: () => [
    { kind: "block", node: "picture", label: node => `图片：${String(node.attrs.alt)}`,
      present: node => ({ label: `图片：${String(node.attrs.alt)}`, image: { source: { assetId: node.attrs.src }, width: 2, height: 1 } }) },
    // A graphic stored in the picture labels its content for the model, and names itself for people.
    { kind: "block-label", node: "picture",
      label: node => node.attrs.graphic === null ? undefined : `流程图 ${JSON.stringify(node.attrs.graphic)}`,
      present: node => node.attrs.graphic === null ? undefined
        : { label: `流程图「${String(node.attrs.alt)}」`, image: { source: { assetId: node.attrs.src } } } }
  ]
});

/** @returns Editor with a graphic picture and a plain picture in one paragraph. */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, paragraph, text, picture], content: { type: "doc", content: [{ type: "body", content: [
    { type: "paragraph", content: [{ type: "text", text: "架构如下" },
      { type: "picture", attrs: { src: "flow-1", alt: "系统架构", graphic: { revision: 1, nodes: ["网关"] } } },
      { type: "picture", attrs: { src: "logo", alt: "标志" } }] }
  ] }] } });
}

/**
 * @param editor - Editor holding the source.
 * @param change - Edits the source JSON's first paragraph content.
 * @returns Changes from the source to the edited copy.
 */
function compare(editor: QuireEditor, change: (content: { type: string; attrs?: Record<string, unknown>; content?: unknown[] }[]) => void) {
  const json = structuredClone(editor.state.doc.toJSON()) as { content: { content: { content: { type: string; attrs?: Record<string, unknown> }[] }[] }[] };
  change(json.content[0]!.content as never);
  const candidate = editor.state.doc.type.schema.nodeFromJSON(json);
  return describeQuireAiChanges(editor.state.doc, candidate, getQuireAi(editor).registry);
}

describe("objects in review changes and searches", () => {
  it("shows a redrawn graphic as images under its people-facing name, not its view label", () => {
    const editor = createEditor();
    const changes = compare(editor, blocks => {
      const graphic = (blocks[0]!.content as { attrs: Record<string, unknown> }[])[1]!;
      graphic.attrs = { ...graphic.attrs, src: "flow-2", graphic: { revision: 2, nodes: ["网关", "通知"] } };
    });
    expect(changes).toEqual([expect.objectContaining({
      kind: "edited", excerpt: "架构如下[流程图「系统架构」][图片：标志]", formats: [],
      objects: [{ kind: "edited", label: "流程图「系统架构」", before: { source: { assetId: "flow-1" } }, after: { source: { assetId: "flow-2" } } }]
    })]);
    expect(changes[0]!.text).toBeUndefined();
  });

  it("lists a replaced image whose label is unchanged, and leaves a renamed one to the text", () => {
    const editor = createEditor();
    const replaced = compare(editor, blocks => { (blocks[0]!.content as { attrs: Record<string, unknown> }[])[2]!.attrs.src = "logo-2"; });
    expect(replaced[0]?.objects).toEqual([{ kind: "edited", label: "图片：标志",
      before: { source: { assetId: "logo" }, width: 2, height: 1 }, after: { source: { assetId: "logo-2" }, width: 2, height: 1 } }]);
    const renamed = compare(editor, blocks => { (blocks[0]!.content as { attrs: Record<string, unknown> }[])[2]!.attrs.alt = "公司标志"; });
    expect(renamed[0]?.objects).toBeUndefined();
    expect(renamed[0]?.text?.filter(piece => piece.kind === "inserted").map(piece => piece.text).join("")).toBe("公司");
  });

  it("finds text inside objects but counts only the text replace_text can change", async () => {
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const requestId = sdk.captureRequest().id;
    const read = async (find: string) => (await sdk.invoke({ requestId, operationId: find, toolName: "document_read", input: { find } })).summary;
    expect(await read("网关")).toBe([
      "## 正文", '[b1] 架构如下[流程图 {"revision":1,"nodes":["网关"]}][图片：标志]',
      '(1 of 1 blocks containing "网关", 0 occurrence(s) in all; 1 of them only inside an object such as a picture or diagram, which replace_text cannot change)'
    ].join("\n"));
    expect(await read("架构")).toMatch(/\(1 of 1 blocks containing "架构", 1 occurrence\(s\) in all\)$/u);
    sdk.destroy();
    editor.destroy();
  });

  it("shows the images of an added paragraph", () => {
    const editor = createEditor();
    const changes = compare(editor, blocks => {
      blocks.push({ type: "paragraph", content: [{ type: "picture", attrs: { src: "chart", alt: "趋势" } }] });
    });
    expect(changes).toEqual([expect.objectContaining({ kind: "inserted",
      objects: [{ kind: "inserted", label: "图片：趋势", after: { source: { assetId: "chart" }, width: 2, height: 1 } }] })]);
  });
});

import { getQuireAi } from "@quirekit/ai-runtime";
import { Editor, Node, type QuireEditor } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import { Document } from "../document";

const paragraph = Node.create({ name: "paragraph", group: "block", content: "text*" });
const text = Node.create({ name: "text", group: "inline" });

/** @returns Editor with the default document font theme. */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [Document, paragraph, text], content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "正文" }] }] } });
}

/**
 * @param editor - Editor under test.
 * @returns View reader and edit runner on fresh requests.
 */
function open(editor: QuireEditor) {
  const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
  const view = () => String(sdk.describeRequest?.(sdk.captureRequest().id));
  const edit = (operations: unknown[]) =>
    sdk.invoke({ requestId: sdk.captureRequest().id, operationId: `op-${Math.random()}`, toolName: "document_edit", input: { operations } });
  return { view, edit };
}

describe("document font AI facts", () => {
  it("sets body and heading fonts per script, leaving other slots", async () => {
    const editor = createEditor();
    const { view, edit } = open(editor);
    expect(view()).toMatch(/## 文档设置\n文档字体：正文 中文 [^、]+、西文 [^；]+；标题 /u);

    await edit([{ op: "setDocumentFontTheme", params: { body: { eastAsia: "宋体", latin: "Times New Roman" }, heading: { eastAsia: "黑体" } } }]);
    const line = view().split("\n").find(entry => entry.startsWith("文档字体："))!;
    expect(line).toMatch(/^文档字体：正文 中文 宋体、西文 Times New Roman；标题 中文 黑体、西文 /u);
    expect(editor.state.doc.attrs.fontTheme.heading.eastAsia).toBe("黑体");
  });

  it("rejects an empty request and leaves the document unchanged", async () => {
    const editor = createEditor();
    const { view, edit } = open(editor);
    view();
    const before = editor.state.doc;
    await expect(edit([{ op: "setDocumentFontTheme", params: {} }])).resolves.toMatchObject({ summary: expect.stringMatching(/^No operation could be applied/u) });
    expect(editor.state.doc).toBe(before);
  });
});

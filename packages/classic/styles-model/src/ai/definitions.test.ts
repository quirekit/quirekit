import { getQuireAi } from "@quirekit/ai-runtime";
import { QuireEditor } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import { defaultWordParagraphFormatting, WordParagraph } from "@quirekit/classic-paragraph-model";
import { describe, expect, it } from "vitest";
import { WordStyles } from "../extension";
import { resolveWordParagraphStyleRegistry } from "../model/registry";

/** @returns Editor with a heading and a body paragraph on the default registry. */
function createEditor(): QuireEditor {
  return new QuireEditor({
    extensions: [StarterKit, WordParagraph, WordStyles],
    content: { type: "doc", content: [
      { type: "paragraph", attrs: { wordParagraph: { ...defaultWordParagraphFormatting, styleId: "Heading1" } }, content: [{ type: "text", text: "标题" }] },
      { type: "paragraph", content: [{ type: "text", text: "正文" }] }
    ] }
  });
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

/** @param editor - Editor under test. @returns Display name of the default style. */
function defaultStyleName(editor: QuireEditor): string {
  const registry = resolveWordParagraphStyleRegistry(editor.state.doc.attrs.wordStyleRegistry);
  return registry.styles[registry.defaultParagraphStyleId]!.name;
}

/**
 * @param view - Rendered view.
 * @param name - Style name.
 * @returns Value on the style's setting line.
 */
function styleLine(view: string, name: string): string {
  const prefix = `样式“${name}”：`;
  return view.split("\n").find(line => line.startsWith(prefix))!.slice(prefix.length);
}

describe("style definition AI facts", () => {
  it("lists the default style and styles in use", () => {
    const editor = createEditor();
    const { view } = open(editor);
    const text = view();
    expect(text).toContain(`样式“${defaultStyleName(editor)}”：`);
    const heading = resolveWordParagraphStyleRegistry(editor.state.doc.attrs.wordStyleRegistry).styles.Heading1!;
    expect(styleLine(text, heading.name)).toMatch(/^\{.*fontSize:"\d+(\.\d+)?pt"/u);
  });

  it("merges font, size and paragraph values into the style and keeps the rest", async () => {
    const editor = createEditor();
    const { view, edit } = open(editor);
    view();
    const name = defaultStyleName(editor);
    const before = resolveWordParagraphStyleRegistry(editor.state.doc.attrs.wordStyleRegistry).styles[resolveWordParagraphStyleRegistry(editor.state.doc.attrs.wordStyleRegistry).defaultParagraphStyleId]!;

    await edit([{ op: "updateWordParagraphStyle", params: { style: name, set: {
      fontFamily: "宋体", fontSize: "16pt", lineSpacing: "28.95pt", firstLineIndent: "2char", align: "justify"
    } } }]);
    const line = styleLine(view(), name);
    expect(line).toContain('fontFamily:"宋体"');
    expect(line).toContain('fontSize:"16pt"');
    expect(line).toContain('lineSpacing:"28.95pt"');
    expect(line).toContain('firstLineIndent:"2char"');
    expect(line).toContain('align:"justify"');
    const after = resolveWordParagraphStyleRegistry(editor.state.doc.attrs.wordStyleRegistry).styles[before.id]!;
    expect(after.name).toBe(before.name);
    expect(after.preservation).toEqual(before.preservation);

    await edit([{ op: "updateWordParagraphStyle", params: { style: name, set: { fontFamily: null } } }]);
    expect(styleLine(view(), name)).not.toContain("fontFamily");
  });

  it("rejects an unknown style and leaves the document unchanged", async () => {
    const editor = createEditor();
    const { view, edit } = open(editor);
    view();
    const before = editor.state.doc;
    await expect(edit([{ op: "updateWordParagraphStyle", params: { style: "不存在的样式", set: { bold: true } } }])).resolves.toMatchObject({ summary: expect.stringContaining("Operation 1 (updateWordParagraphStyle)") });
    expect(editor.state.doc).toBe(before);
  });
});

import { getQuireAi } from "@quirekit/ai-runtime";
import { createEditor, type QuireEditor } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import { describe, expect, it } from "vitest";
import { Link } from "../link";

/** @returns Editor whose paragraph links "官网" to the product site. */
function createLinkedEditor(): QuireEditor {
  return createEditor({
    extensions: [StarterKit, Link],
    content: { type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "访问" },
      { type: "text", text: "官网", marks: [{ type: "link", attrs: { href: "https://quirekit.dev" } }] },
      { type: "text", text: "了解文档与示例。" }
    ] }] }
  });
}

/**
 * @param editor - Editor under test.
 * @returns SDK with an open request whose context assigned block ids.
 */
function open(editor: QuireEditor) {
  const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
  const requestId = sdk.captureRequest().id;
  const edit = (operationId: string, operations: unknown[]) =>
    sdk.invoke({ requestId, operationId, toolName: "document_edit", input: { operations } });
  return { sdk, requestId, edit };
}

/**
 * @param editor - Editor under test.
 * @returns Link targets of the text runs, in order.
 */
function linkedRuns(editor: QuireEditor): string[] {
  const runs: string[] = [];
  editor.state.doc.descendants(node => {
    const href = node.marks.find(mark => mark.type.name === "link")?.attrs.href as string | undefined;
    if (node.isText && href !== undefined) runs.push(`${node.text}→${href}`);
  });
  return runs;
}

describe("link AI facts", () => {
  it("shows links in the document view with their targets", () => {
    const editor = createLinkedEditor();
    const { sdk, requestId } = open(editor);
    expect(sdk.describeRequest?.(requestId)).toContain("[b1] 访问[官网]{link:\"https://quirekit.dev\"}了解文档与示例。");
  });

  it("links text, changes a target and removes a link through document_edit", async () => {
    const editor = createLinkedEditor();
    const { edit } = open(editor);

    await edit("add", [{ op: "format", blocks: ["b1"], text: "文档", set: { link: "https://quirekit.dev/docs" } }]);
    expect(linkedRuns(editor)).toEqual(["官网→https://quirekit.dev", "文档→https://quirekit.dev/docs"]);
    await edit("change", [{ op: "format", blocks: ["b1"], text: "官网", set: { link: "https://quirekit.com" } }]);
    expect(linkedRuns(editor)).toEqual(["官网→https://quirekit.com", "文档→https://quirekit.dev/docs"]);
    await edit("remove", [{ op: "format", blocks: ["b1"], text: "文档", set: { link: null } }]);
    expect(linkedRuns(editor)).toEqual(["官网→https://quirekit.com"]);
  });

  it("inserts linked text from inline markup", async () => {
    const editor = createLinkedEditor();
    const { edit } = open(editor);

    await edit("insert", [{ op: "insert", after: "b1", blocks: ["详见[更新日志]{link:\"https://quirekit.dev/changelog\"}。"] }]);
    expect(linkedRuns(editor)).toEqual(["官网→https://quirekit.dev", "更新日志→https://quirekit.dev/changelog"]);
  });

  it("rejects an unsafe target and leaves the document unchanged", async () => {
    const editor = createLinkedEditor();
    const { edit } = open(editor);
    const before = editor.state.doc;

    await expect(edit("unsafe", [{ op: "format", blocks: ["b1"], text: "文档", set: { link: "javascript:alert(1)" } }]))
      .resolves.toMatchObject({ summary: expect.stringContaining("Operation 1 (format)") });
    expect(editor.state.doc).toBe(before);
  });
});

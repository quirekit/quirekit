// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createMsfeEditor, type MsfeEditor } from "@quirekit/msfe-core";
import { StarterKit } from "@quirekit/msfe-starter-kit";
import { Comments, getComments, type CommentsOptions } from "@quirekit/msfe-comments";
import type { QuireDocumentEvent, QuireDocumentPreview } from "@quirekit/ai-runtime";
import { MsfeAi } from "./extension";
import { createMsfeDocumentSdk } from "./sdk";

const editors: MsfeEditor[] = [];
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

const user = { id: "u1", name: "张三" };

/** @param options - Comment options. @returns Editor with one human comment on "42". */
function mount(options: Partial<CommentsOptions> = {}): MsfeEditor {
  const parent = document.createElement("div");
  document.body.append(parent);
  const markdown = "营收增长 42%。\n\n第二段。";
  const editor = createMsfeEditor({ parent, markdown, extensions: [StarterKit, MsfeAi, Comments.configure({ user, ...options })] });
  editors.push(editor);
  const at = markdown.indexOf("42");
  getComments(editor)!.add({ body: "这个数字对吗？" }, { from: at, to: at + 2 });
  return editor;
}

describe("AI comments", () => {
  it("reads threads and writes comments as the AI on the user's behalf, taking them back on rejection", async () => {
    const editor = mount();
    const sdk = createMsfeDocumentSdk(editor, { documentId: "doc", authorizeWrite: () => ({ allowed: true, review: true }) });
    const events: QuireDocumentEvent[] = [];
    sdk.subscribe(event => events.push(event));
    const request = sdk.captureRequest();
    expect(sdk.describeRequest(request.id)).toContain("[b1] 营收增长 42%。  ⟨批注 c1⟩");
    expect(sdk.describeRequest(request.id)).toContain("[c1] 于 b1“42”，未解决\n  张三：这个数字对吗？");
    const result = await sdk.invoke({ toolName: "document_edit", operationId: "op", requestId: request.id, input: { operations: [
      { op: "replyComment", annotation: "c1", params: { body: "已按财报核对。" } },
      { op: "resolveComment", annotation: "c1" },
      { op: "addComment", block: "b2", text: "第二段", params: { body: "建议补充数据来源。" } }
    ] } });
    expect(result.summary).toContain("Applied 3 operation(s).");
    const threads = getComments(editor)!.threads();
    expect(threads).toHaveLength(2);
    const reply = threads[0]!.thread.messages[1]!;
    expect(reply.author).toEqual({ id: "quirekit-ai", name: "QuireKit AI", agent: true });
    expect(reply.requestedBy).toEqual(user);
    expect(threads[0]!.thread.resolved).toBe(true);
    expect(threads[1]!.thread.anchor?.quote?.exact).toBe("第二段");
    expect(sdk.reviewRequest(request.id)).toBe(true);
    const preview = events.find((event): event is { type: "preview"; preview: QuireDocumentPreview } => event.type === "preview")!.preview;
    expect(preview.changes?.map(change => [change.kind, change.section])).toEqual([["inserted", "批注"], ["edited", "批注"], ["inserted", "批注"]]);
    sdk.decidePreview(preview.id, "rejected");
    const after = getComments(editor)!.threads();
    expect(after).toHaveLength(1);
    expect(after[0]!.thread.messages).toHaveLength(1);
    expect(after[0]!.thread.resolved).toBe(false);
    sdk.destroy();
  });

  it("follows the host's comment permissions", async () => {
    const editor = mount({ canResolve: () => false });
    const sdk = createMsfeDocumentSdk(editor, { documentId: "doc" });
    const request = sdk.captureRequest();
    const result = await sdk.invoke({ toolName: "document_edit", operationId: "op", requestId: request.id, input: { operations: [{ op: "resolveComment", annotation: "c1" }] } });
    expect(result.summary).toContain("Operation 1 (resolveComment): the user may not write or resolve these comments.");
    expect(getComments(editor)!.threads()[0]!.thread.resolved).toBe(false);
    sdk.destroy();
  });
});

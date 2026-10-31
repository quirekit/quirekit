import { Editor, Node, type QuireEditor } from "@quirekit/core";
import type { Node as PMNode } from "@quirekit/pm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {} from "@quirekit/ai-contract";
import type { QuireAiToolWriteDecision } from "../../tool-host";
import { getQuireAi } from "../manager";
import type { QuireAiPresentation } from "../types";

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({ name: "paragraph", group: "block", content: "inline*" });
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });

/** @returns Editor with three paragraphs b1–b3. */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, paragraph, text], content: { type: "doc", content: [{ type: "body", content: [
    { type: "paragraph", content: [{ type: "text", text: "第一段" }] },
    { type: "paragraph", content: [{ type: "text", text: "核心指标全部达成" }] },
    { type: "paragraph", content: [{ type: "text", text: "第三段" }] }
  ] }] } });
}

/** Policy that approves the whole edit before writing, so streamed operations are only previewed. */
const approveFirst: QuireAiToolWriteDecision = { allowed: true, mode: "direct", preview: "required" };

/**
 * Opens an SDK request whose context read assigns block ids b1–b3.
 * @param editor - Editor under test.
 * @param decision - Write policy.
 * @returns SDK, request id and helpers.
 */
function open(editor: QuireEditor, decision: QuireAiToolWriteDecision = { allowed: true, mode: "direct" }) {
  const manager = getQuireAi(editor);
  const sdk = manager.createDocumentSdk({ documentId: "d", authorizeWrite: () => decision });
  const requestId = sdk.captureRequest().id;
  const controller = new AbortController();
  // Streaming previews are paced; running the pending timer shows each delta as if the host kept up.
  const observe = (operationId: string, operations: unknown[]) => {
    sdk.observeInput({ requestId, operationId, toolName: "document_edit", input: { operations } }, { signal: controller.signal });
    vi.runOnlyPendingTimers();
  };
  const invoke = (operationId: string, operations: unknown[]) =>
    sdk.invoke({ requestId, operationId, toolName: "document_edit", input: { operations } });
  return { manager, sdk, requestId, controller, observe, invoke };
}

/**
 * @param presentation - Preview to render.
 * @returns Presented document.
 */
function presented(presentation: QuireAiPresentation | null): PMNode {
  if (presentation === null) throw new Error("no preview");
  return presentation.steps.reduce((current, step) => step.apply(current).doc!, presentation.baseDoc);
}

/**
 * @param presentation - Preview.
 * @returns Text of each role range.
 */
function roles(presentation: QuireAiPresentation | null): string[] {
  const shown = presented(presentation);
  return presentation!.ranges.map(range => `${range.role}:${shown.textBetween(range.from, range.to, "|")}`);
}

describe("document_edit streaming preview", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("plans only the latest of deltas that arrive faster than the pace", () => {
    const editor = createEditor();
    const { manager, sdk, requestId, controller } = open(editor);
    const published: unknown[] = [];
    manager.previews.subscribe(presentation => published.push(presentation));
    const send = (replace: string) => sdk.observeInput(
      { requestId, operationId: "op", toolName: "document_edit", input: { operations: [{ op: "replace_text", block: "b2", find: "全部达成", replace }] } },
      { signal: controller.signal });

    send("基");
    expect(roles(manager.previews.current)).toEqual(["removed:全部达成", "inserted:基"]);
    send("基本");
    send("基本达");
    send("基本达成");
    expect(published).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(published).toHaveLength(2);
    expect(roles(manager.previews.current)).toEqual(["removed:全部达成", "inserted:基本达成"]);
  });

  it("drops a paced delta once the operation is cancelled or the complete edit is previewed", async () => {
    const editor = createEditor();
    const { manager, sdk, requestId, controller, invoke } = open(editor, { allowed: true, mode: "direct", preview: "required" });
    const send = (operationId: string, signal: AbortSignal, operations: unknown[]) => sdk.observeInput(
      { requestId, operationId, toolName: "document_edit", input: { operations } }, { signal });

    send("cancelled", controller.signal, [{ op: "replace_text", block: "b2", find: "全部达成", replace: "基" }]);
    send("cancelled", controller.signal, [{ op: "replace_text", block: "b2", find: "全部达成", replace: "基本" }]);
    controller.abort();
    vi.advanceTimersByTime(1000);
    expect(manager.previews.current).toBeNull();

    const live = new AbortController();
    send("review", live.signal, [{ op: "delete", blocks: ["b1"] }]);
    send("review", live.signal, [{ op: "delete", blocks: ["b1"] }, { op: "delete", blocks: ["b2"] }]);
    const pending = invoke("review", [{ op: "delete", blocks: ["b3"] }]);
    await vi.waitFor(() => expect(manager.previews.current?.review).toBeDefined());
    vi.advanceTimersByTime(1000);
    expect(roles(manager.previews.current)).toEqual(["removed:第三段"]);
    manager.previews.current?.review?.reject();
    await pending;
  });

  it("grows the preview as replacement text streams, keeping the old text as removed", () => {
    const editor = createEditor();
    const { manager, observe } = open(editor);
    const committed = editor.state.doc;

    observe("op", [{ op: "replace_text", block: "b2", find: "全部达成", replace: "基" }]);
    expect(roles(manager.previews.current)).toEqual(["removed:全部达成", "inserted:基"]);
    observe("op", [{ op: "replace_text", block: "b2", find: "全部达成", replace: "基本达成" }]);
    expect(presented(manager.previews.current).child(0).child(1).textContent).toBe("核心指标全部达成基本达成");
    expect(roles(manager.previews.current)).toEqual(["removed:全部达成", "inserted:基本达成"]);
    expect(editor.state.doc).toBe(committed);
  });

  it("publishes only deltas that change what the preview shows", () => {
    const editor = createEditor();
    const { manager, observe } = open(editor, approveFirst);
    const published: unknown[] = [];
    manager.previews.subscribe(presentation => published.push(presentation));

    observe("op", [{ op: "delete", blocks: ["b1"] }, { op: "replace_text", block: "b2" }]);
    observe("op", [{ op: "delete", blocks: ["b1"] }, { op: "replace_text", block: "b2", find: "全部" }]);
    observe("op", [{ op: "delete", blocks: ["b1"] }, { op: "replace_text", block: "b2", find: "全部达成" }]);
    expect(published).toHaveLength(1);
    observe("op", [{ op: "delete", blocks: ["b1"] }, { op: "replace_text", block: "b2", find: "全部达成", replace: "达" }]);
    expect(published).toHaveLength(2);
  });

  it("waits for identifiers and search text to finish streaming", () => {
    const editor = createEditor();
    const { manager, observe } = open(editor, approveFirst);

    observe("op", [{ op: "replace", block: "b" }]);
    expect(manager.previews.current).toBeNull();
    observe("op", [{ op: "replace_text", block: "b2", find: "全部" }]);
    expect(manager.previews.current).toBeNull();
    observe("op", [{ op: "delete", blocks: ["b1"] }, { op: "format", blocks: ["b"] }]);
    expect(roles(manager.previews.current)).toEqual(["removed:第一段"]);
  });

  it("previews inserts as inserted blocks and replaces as removed plus inserted content", () => {
    const editor = createEditor();
    const { manager, observe } = open(editor, approveFirst);

    observe("op", [
      { op: "replace", block: "b1", text: "新开头" },
      { op: "insert", after: "b3", blocks: ["结尾一", "结尾"] }
    ]);
    expect(roles(manager.previews.current)).toEqual(["removed:第一段", "inserted:新开头", "inserted:结尾一|结尾"]);
  });

  it("hides unclosed trailing markup until it closes", () => {
    const editor = createEditor();
    const { manager, observe } = open(editor);

    observe("op", [{ op: "replace", block: "b1", text: "新**加" }]);
    expect(roles(manager.previews.current)).toEqual(["removed:第一段", "inserted:新"]);
    observe("op", [{ op: "insert", at: "end", blocks: ["见[附录]{col"] }]);
    expect(roles(manager.previews.current)).toEqual(["inserted:见"]);
  });

  it("recomputes after a document change and clears when the edit no longer plans", () => {
    const editor = createEditor();
    const { manager, observe } = open(editor);
    observe("op", [{ op: "replace_text", block: "b2", find: "全部达成", replace: "达标" }]);

    editor.commands.insertContentAt(2, "前");
    expect(manager.previews.current?.baseDoc).toBe(editor.state.doc);
    expect(roles(manager.previews.current)).toEqual(["removed:全部达成", "inserted:达标"]);

    const first = editor.state.doc.child(0).child(0).nodeSize;
    const second = editor.state.doc.child(0).child(1).nodeSize;
    editor.commands.deleteRange({ from: 1 + first, to: 1 + first + second });
    expect(manager.previews.current).toBeNull();
  });

  it("clears on cancellation, on commit and when an invocation fails validation", async () => {
    const editor = createEditor();
    const session = open(editor);
    session.observe("op", [{ op: "replace", block: "b1", text: "甲" }]);
    session.controller.abort();
    expect(session.manager.previews.current).toBeNull();

    const next = open(editor);
    next.observe("commit", [{ op: "replace", block: "b1", text: "乙" }]);
    await next.invoke("commit", [{ op: "replace", block: "b1", text: "乙" }]);
    expect(editor.state.doc.child(0).child(0).textContent).toBe("乙");
    expect(next.manager.previews.current).toBeNull();

    next.observe("bad", [{ op: "replace", block: "b1", text: "丙" }]);
    expect((await next.invoke("bad", [{ op: "replace", block: "b1" }])).summary).toMatch(/Operation 1 \(replace\)/u);
    expect(next.manager.previews.current).toBeNull();
  });

  it("keeps the complete edit previewed with an in-document review while approval is pending", async () => {
    const editor = createEditor();
    const { manager, sdk, invoke } = open(editor, { allowed: true, mode: "direct", preview: "required" });
    const previews: string[] = [];
    const views: { source: string | undefined; candidate: string | undefined }[] = [];
    sdk.subscribe(event => {
      if (event.type !== "preview") return;
      previews.push(event.preview.id);
      views.push({ source: event.preview.sourceView, candidate: event.preview.candidateView });
    });

    const pending = invoke("review", [{ op: "delete", blocks: ["b3"] }]);
    await vi.waitFor(() => expect(previews).toHaveLength(1));
    expect(roles(manager.previews.current)).toEqual(["removed:第三段"]);
    expect(views[0]?.source).toContain("\n第三段");
    expect(views[0]?.candidate).not.toContain("第三段");
    expect(views[0]?.candidate).not.toMatch(/\[b\d+\]/u);
    expect(manager.previews.current?.review?.reject()).toBe(true);
    expect(sdk.decidePreview(previews[0]!, "approved")).toBe(false);
    await pending;
    expect(manager.previews.current).toBeNull();
    expect(editor.state.doc.child(0).childCount).toBe(3);
  });
});

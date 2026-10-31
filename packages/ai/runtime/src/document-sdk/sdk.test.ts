import { afterEach, describe, expect, it, vi } from "vitest";
import { Type } from "typebox";
import type { QuireDocumentTool } from "../document-tools";
import { createQuireDocumentSdk } from "./sdk";
import { createDocumentFixture, createReplaceTool } from "./fixture.test-support";
import type { QuireDocumentInvocation, QuireDocumentPreview, QuireDocumentSdkOptions } from "./types";

const editors: ReturnType<typeof createDocumentFixture>[] = [];
/** @param overrides - Product settings for this case. @returns SDK with an actual typed-command document tool. */
function fixture(overrides: Partial<QuireDocumentSdkOptions> = {}) {
  const editor = createDocumentFixture();
  editors.push(editor);
  editor.commands.setTextSelection({ from: 1, to: 6 });
  const sdk = createQuireDocumentSdk({ editor, documentId: "test-document", tools: host => [createReplaceTool(host)],
    authorizeWrite: () => ({ allowed: true, mode: "direct" }), ...overrides });
  return { editor, sdk };
}
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy(); });

describe("document SDK independent of any model or chat", () => {
  it("rejects replacing a captured selection whose original content was concurrently replaced", async () => {
    const { sdk, editor } = fixture();
    const request = sdk.captureRequest();
    editor.commands.insertContentAt({ from: 1, to: 6 }, { type: "text", text: "Other" });
    await expect(sdk.invoke({ toolName: "replace", operationId: "concurrent", requestId: request.id, input: { text: "Agent" } })).rejects.toMatchObject({ code: "stale-target" });
    expect(editor.state.doc.textContent).toBe("Other Beta");
  });

  it("does not carry a failed detached command into the next preview", async () => {
    let fail = true;
    const { sdk, editor } = fixture({ authorizeWrite: () => ({ allowed: true, mode: "direct", preview: "required" }),
      tools: host => [{ ...createReplaceTool(host), async execute(_input, context) {
        const result = await host.executeWrite({ toolCallId: context.callId, capabilityId: "test.capture", signal: context.signal,
          target: { kind: "document", id: "root" }, supportedModes: ["direct"], canApply: () => true,
          apply: target => {
            target.commands.insertContentAt(1, { type: "text", text: fail ? "FAILED " : "GOOD " });
            if (fail) throw new Error("capture failed");
            return true;
          } });
        return { value: result, summary: "Inserted" };
      } }] });
    await expect(sdk.invoke({ toolName: "replace", operationId: "failed-capture", input: { text: "unused" } })).rejects.toMatchObject({ code: "tool-failed" });
    fail = false;
    sdk.subscribe(event => {
      if (event.type !== "preview") return;
      expect(event.preview.candidateText).toBe("GOOD Alpha Beta");
      sdk.decidePreview(event.preview.id, "approved");
    });
    await sdk.invoke({ toolName: "replace", operationId: "clean-capture", input: { text: "unused" } });
    expect(editor.state.doc.textContent).toBe("GOOD Alpha Beta");
  });

  it("returns stable errors for malformed JSON transport envelopes", async () => {
    const { sdk } = fixture();
    await expect(sdk.invoke(null as unknown as QuireDocumentInvocation)).rejects.toMatchObject({ code: "invalid-input" });
    await expect(sdk.invoke({ operationId: 123, toolName: "replace", input: {} } as unknown as QuireDocumentInvocation)).rejects.toMatchObject({ code: "invalid-operation" });
    await expect(sdk.invoke({ operationId: "invalid", toolName: "replace" } as QuireDocumentInvocation)).rejects.toMatchObject({ code: "invalid-input" });
    expect(sdk.getOperation("invalid")).toBeUndefined();
  });

  it("stops advertising writes in read-only mode and still rejects previously discovered writes", async () => {
    const { sdk, editor } = fixture();
    const request = sdk.captureRequest();
    expect(sdk.tools(request.id)).toHaveLength(1);
    editor.setEditable(false);
    expect(sdk.tools(request.id)).toHaveLength(0);
    await expect(sdk.invoke({ toolName: "replace", operationId: "readonly", requestId: request.id, input: { text: "Oops" } })).rejects.toMatchObject({ code: "editor-read-only" });
    expect(editor.state.doc.textContent).toBe("Alpha Beta");
  });

  it("serializes writes from separate SDK clients and cancels queued work promptly", async () => {
    const { editor, sdk } = fixture({ authorizeWrite: () => ({ allowed: true, mode: "direct", preview: "required" }) });
    const other = createQuireDocumentSdk({ editor, documentId: "test-document", tools: host => [createReplaceTool(host)],
      authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    let previewId: string | undefined;
    sdk.subscribe(event => { if (event.type === "preview") previewId = event.preview.id; });
    const first = sdk.invoke({ toolName: "replace", operationId: "first", input: { text: "First" } });
    await vi.waitFor(() => expect(previewId).toBeDefined());
    const queued = other.invoke({ toolName: "replace", operationId: "queued", input: { text: "Queued" } });
    await Promise.resolve();
    expect(editor.state.doc.textContent).toBe("Alpha Beta");
    expect(other.cancel("queued")).toBe(true);
    await expect(queued).rejects.toMatchObject({ code: "cancelled" });
    sdk.decidePreview(previewId!, "approved");
    await first;
    expect(editor.state.doc.textContent).toBe("First Beta");
    expect(other.getOperation("queued")?.committed).toBe(false);
  });

  it("exposes JSON descriptors and validates arguments before writes", async () => {
    const { editor, sdk } = fixture();
    expect(JSON.parse(JSON.stringify(sdk.tools()))[0]).toMatchObject({ name: "replace", effect: "write" });
    expect(sdk.tools()[0]).not.toHaveProperty("execute");
    await expect(sdk.invoke({ toolName: "replace", operationId: "bad", input: { text: 123 } })).rejects.toMatchObject({ code: "invalid-input" });
    expect(editor.state.doc.textContent).toBe("Alpha Beta");
  });

  it("maps the captured selection across edits and ignores subsequent cursor changes", async () => {
    const { editor, sdk } = fixture();
    const request = sdk.captureRequest();
    editor.commands.insertContentAt(1, { type: "text", text: "Prefix " });
    editor.commands.setTextSelection({ from: 14, to: 18 });
    await sdk.invoke({ toolName: "replace", operationId: "mapped", requestId: request.id, input: { text: "First" } });
    expect(editor.state.doc.textContent).toBe("Prefix First Beta");
    sdk.releaseRequest(request.id);
  });

  it("rejects a deleted original target instead of editing the current cursor", async () => {
    const { editor, sdk } = fixture();
    const request = sdk.captureRequest();
    editor.commands.deleteRange({ from: 1, to: 6 });
    await expect(sdk.invoke({ toolName: "replace", operationId: "deleted", requestId: request.id, input: { text: "Oops" } })).rejects.toMatchObject({ code: "stale-target" });
    expect(editor.state.doc.textContent).toBe(" Beta");
  });

  it("deduplicates concurrent and completed operations, rejecting different arguments", async () => {
    const { editor, sdk } = fixture();
    const request = { toolName: "replace", operationId: "once", input: { text: "First" } };
    const results = await Promise.all([sdk.invoke(request), sdk.invoke(request)]);
    expect(results[0]).toEqual(results[1]);
    expect(await sdk.invoke(request)).toEqual(results[0]);
    await expect(sdk.invoke({ ...request, input: { text: "Second" } })).rejects.toMatchObject({ code: "operation-conflict" });
    expect(editor.state.doc.textContent).toBe("First Beta");
    expect(sdk.getOperation("once")?.receipts).toHaveLength(1);
  });

  it("preserves a receipt when cancellation arrives during commit observation", async () => {
    const { editor, sdk } = fixture();
    sdk.subscribe(event => { if (event.type === "receipt") sdk.cancel(event.operationId); });
    sdk.subscribe(() => { throw new Error("broken observer"); });
    await expect(sdk.invoke({ toolName: "replace", operationId: "commit-cancel", input: { text: "First" } })).rejects.toMatchObject({ code: "cancelled" });
    expect(sdk.getOperation("commit-cancel")).toMatchObject({ status: "cancelled", committed: true });
    expect(sdk.getOperation("commit-cancel")?.receipts).toHaveLength(1);
    expect(editor.state.doc.textContent).toBe("First Beta");
  });

  it("retains committed effects even if a tool throws after a typed command", async () => {
    const { sdk } = fixture({ tools: host => {
      const original = createReplaceTool(host);
      return [{ ...original, async execute(input, context) { await original.execute(input as { text: string }, context); throw new Error("secret-provider-error"); } }];
    } });
    await expect(sdk.invoke({ toolName: "replace", operationId: "commit-fail", input: { text: "First" } })).rejects.toMatchObject({ code: "tool-failed" });
    expect(sdk.getOperation("commit-fail")).toMatchObject({ status: "failed", committed: true });
    expect(JSON.stringify(sdk.getOperation("commit-fail"))).not.toContain("secret-provider-error");
  });

  it("keeps full serialized candidates detached until review and rejects stale approval", async () => {
    const { sdk, editor } = fixture({ authorizeWrite: () => ({ allowed: true, mode: "direct", preview: "required" }) });
    let candidate: QuireDocumentPreview | undefined;
    sdk.subscribe(event => { if (event.type === "preview") candidate = event.preview; });
    const pending = sdk.invoke({ toolName: "replace", operationId: "preview", input: { text: "x".repeat(1500) } });
    await vi.waitFor(() => expect(candidate).toBeDefined());
    expect(candidate!.candidateText.length).toBeGreaterThan(1500);
    expect(JSON.parse(JSON.stringify(candidate))).toEqual(candidate);
    expect(editor.state.doc.textContent).toBe("Alpha Beta");
    editor.commands.insertContentAt(11, { type: "text", text: "!" });
    expect(sdk.decidePreview(candidate!.id, "approved")).toBe(true);
    await expect(pending).rejects.toMatchObject({ code: "stale-target" });
    expect(sdk.decidePreview(candidate!.id, "approved")).toBe(false);
    expect(editor.state.doc.textContent).toBe("Alpha Beta!");
  });

  it("aborts review on destruction without writing a candidate", async () => {
    const { sdk, editor } = fixture({ authorizeWrite: () => ({ allowed: true, mode: "direct", preview: "required" }) });
    let previewId: string | undefined;
    sdk.subscribe(event => { if (event.type === "preview") previewId = event.preview.id; });
    const pending = sdk.invoke({ toolName: "replace", operationId: "destroy", input: { text: "New" } });
    await vi.waitFor(() => expect(previewId).toBeDefined());
    sdk.destroy();
    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
    expect(sdk.decidePreview(previewId!, "approved")).toBe(false);
    expect(editor.state.doc.textContent).toBe("Alpha Beta");
  });

  it("never starts a pre-aborted operation and rechecks read authorization", async () => {
    const execute = vi.fn(async () => ({ value: null, summary: "read" }));
    const tool: QuireDocumentTool = { name: "read", label: "Read", description: "Read", effect: "read", parameters: Type.Object({}), execute };
    const { sdk } = fixture({ tools: () => [tool], authorizeRead: () => false });
    await expect(sdk.invoke({ toolName: "read", input: {}, operationId: "aborted" }, { signal: AbortSignal.abort() })).rejects.toMatchObject({ code: "cancelled" });
    await expect(sdk.invoke({ toolName: "read", input: {}, operationId: "denied" })).rejects.toMatchObject({ code: "permission-denied" });
    expect(execute).not.toHaveBeenCalled();
  });
});

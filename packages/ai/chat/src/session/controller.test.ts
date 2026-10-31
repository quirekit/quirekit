import { describe, expect, it, vi } from "vitest";
import type { AiChatResponderRequest } from "../types";
import { createAiChatController } from "./controller";
import { createChatFixture } from "./fixture.test-support";

describe("retained first-party conversation", () => {
  it("captures before async work, survives view unsubscribe and freezes active policy", async () => {
    let request!: AiChatResponderRequest;
    let complete!: (value: { content: string }) => void;
    const fixture = createChatFixture({ respond: async value => { request = value; return new Promise(resolve => { complete = resolve; }); } });
    const controller = createAiChatController(fixture.options);
    const disposeView = controller.subscribe(vi.fn());
    controller.setDraft("Original prompt");
    const pending = controller.submit();
    expect(fixture.document.captureRequest).toHaveBeenCalledOnce();
    expect(request.requestId).toBe("target");
    controller.setDraft("Next draft");
    controller.selectModel("second");
    controller.selectAuthorizationMode("full-access");
    disposeView();
    expect(request.signal.aborted).toBe(false);
    request.onContentDelta("streamed");
    expect(controller.getSnapshot()).toMatchObject({ draft: "Next draft", selectedModelId: "first", authorizationMode: "request-approval", pending: true });
    complete({ content: "finished" });
    await pending;
    expect(controller.getSnapshot().messages.at(-1)?.content).toBe("finished");
    expect(controller.getSnapshot().pending).toBe(false);
    expect(fixture.document.releaseRequest).toHaveBeenCalledWith("target");
  });

  it("keeps committed document facts and partial content after stopping", async () => {
    const fixture = createChatFixture({ respond: request => new Promise((_, reject) => {
      request.onContentDelta("Already explained");
      request.signal.addEventListener("abort", () => reject(new Error("secret provider body")), { once: true });
    }) });
    const controller = createAiChatController(fixture.options);
    controller.setDraft("Change document");
    const pending = controller.submit();
    fixture.emit({ type: "operation", operation: { id: "write", documentId: "fixture", toolName: "edit", status: "completed", committed: true, receipts: [] } });
    controller.stop();
    await pending;
    expect(controller.getSnapshot().messages.at(-1)).toMatchObject({ content: "Already explained", status: "stopped", errorCode: "cancelled" });
    expect(controller.getSnapshot().documentEvents).toHaveLength(1);
    expect(controller.getSnapshot().operationMessageIds.write).toBe(controller.getSnapshot().messages.at(-1)?.id);
  });

  it("settles cancellation before resetting both native and displayed history", async () => {
    let settle!: () => void;
    const reset = vi.fn();
    const fixture = createChatFixture({ reset, respond: request => new Promise((_, reject) => {
      settle = () => reject(new DOMException("Stopped", "AbortError"));
      request.signal.addEventListener("abort", () => undefined);
    }) });
    const controller = createAiChatController(fixture.options);
    controller.setDraft("Old request");
    void controller.submit();
    const identity = controller.getSnapshot().conversationId;
    const pending = controller.reset();
    expect(reset).not.toHaveBeenCalled();
    controller.setDraft("New draft");
    await controller.submit();
    expect(fixture.document.captureRequest).toHaveBeenCalledOnce();
    expect(controller.reset()).toBe(pending);
    settle();
    await pending;
    expect(reset).toHaveBeenCalledOnce();
    expect(controller.getSnapshot()).toMatchObject({ messages: [], pending: false, draft: "New draft" });
    expect(controller.getSnapshot().conversationId).not.toBe(identity);
  });

  it("only reflects SDK accepted review events and does not invent a successful commit", async () => {
    const fixture = createChatFixture();
    const controller = createAiChatController(fixture.options);
    fixture.emit({ type: "preview", preview: { id: "review", operationId: "op", documentId: "fixture", capabilityId: "format", sourceDocumentRevision: "r", sourceDocument: {}, candidateDocument: {}, sourceText: "x", candidateText: "x", formatOnly: true, target: { id: "selection", kind: "selection" } } });
    controller.decidePreview("review", "approved");
    expect(controller.getSnapshot().reviews[0]?.state).toBe("pending");
    fixture.emit({ type: "preview-settled", previewId: "review", decision: "approved" });
    fixture.emit({ type: "operation", operation: { id: "op", documentId: "fixture", toolName: "format", committed: false, receipts: [], status: "failed", error: { code: "stale", message: "Changed document" } } });
    expect(controller.getSnapshot().reviews[0]?.state).toBe("approved");
    expect(controller.getSnapshot().documentEvents.at(-1)).toMatchObject({ operation: { committed: false, status: "failed" } });
  });

  it.each([false, true])("keeps a late operation in its original turn while another turn is active (SDK start: %s)", async hasStart => {
    const fixture = createChatFixture();
    const operation = { id: "previous-write", documentId: "fixture", toolName: "edit", committed: false, receipts: [] };
    fixture.options.responder.respond = async request => {
      request.onTrace({ id: "previous-call", operationId: operation.id, runId: request.id, kind: "tool-call", status: "running", label: "edit", startedAt: new Date().toISOString() });
      if (hasStart) fixture.emit({ type: "operation", operation: { ...operation, status: "running" } });
      return { content: "First turn" };
    };
    const controller = createAiChatController(fixture.options);
    controller.setDraft("First");
    await controller.submit();
    const owner = controller.getSnapshot().messages[1]!.id;
    let finish!: (result: { content: string }) => void;
    fixture.options.responder.respond = () => new Promise(resolve => { finish = resolve; });
    controller.setDraft("Second");
    const pending = controller.submit();
    fixture.emit({ type: "operation", operation: { ...operation, status: "completed", committed: true } });
    const snapshot = controller.getSnapshot();
    expect(snapshot.operationMessageIds[operation.id]).toBe(owner);
    expect(snapshot.messages[1]!.parts?.filter(part => part.kind === "document")).toHaveLength(1);
    expect(snapshot.messages[3]!.parts).toEqual([]);
    finish({ content: "Second turn" });
    await pending;
  });

  it("destroys document and native resources once while cancelling an active turn", async () => {
    let signal!: AbortSignal;
    const fixture = createChatFixture({ respond: request => new Promise((_, reject) => {
      signal = request.signal;
      signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
    }) });
    const controller = createAiChatController(fixture.options);
    controller.setDraft("Pending");
    void controller.submit();
    const first = controller.destroy();
    expect(controller.destroy()).toBe(first);
    await first;
    expect(signal.aborted).toBe(true);
    expect(fixture.document.destroy).toHaveBeenCalledOnce();
    expect(fixture.options.responder.destroy).toHaveBeenCalledOnce();
  });

  it("does not let delayed preferences override a newer explicit choice", async () => {
    let resolve!: (value: string) => void;
    const fixture = createChatFixture();
    const controller = createAiChatController({ ...fixture.options, modelSelectionStore: { loadSelectedModelId: () => new Promise(done => { resolve = done; }), saveSelectedModelId: vi.fn() } });
    await Promise.resolve();
    controller.selectModel("second");
    resolve("first");
    await new Promise(done => setTimeout(done, 0));
    expect(controller.getSnapshot().selectedModelId).toBe("second");
  });

  it("continues a restored conversation and settles what the earlier document left open", () => {
    const fixture = createChatFixture();
    const earlier = createAiChatController(fixture.options).getSnapshot();
    const preview = { id: "p1", operationId: "op" } as never;
    const controller = createAiChatController({ ...fixture.options, restore: {
      conversationId: earlier.conversationId, documentEvents: [], operationMessageIds: { op: "a1" },
      messages: [
        { id: "u1", role: "user", content: "Edit", createdAt: "2026-10-18T00:00:00Z", status: "complete" },
        { id: "a1", role: "assistant", content: "half", parts: [], createdAt: "2026-10-18T00:00:01Z", pending: true, status: "streaming" }
      ],
      reviews: [{ messageId: "a1", preview, state: "pending" }, { messageId: "a1", preview, state: "approved" }]
    } });
    const snapshot = controller.getSnapshot();
    expect(snapshot.conversationId).toBe(earlier.conversationId);
    expect(snapshot.messages.map(message => [message.id, message.status, message.pending ?? false])).toEqual([["u1", "complete", false], ["a1", "stopped", false]]);
    expect(snapshot.reviews.map(review => review.state)).toEqual(["expired", "approved"]);
    expect(snapshot.operationMessageIds).toEqual({ op: "a1" });
    expect(snapshot.pending).toBe(false);
  });
});

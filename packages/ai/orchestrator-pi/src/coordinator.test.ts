import { AgentHarness, MemorySessionRepo, type SessionMetadata } from "@earendil-works/pi-agent-core";
import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core/harness/context";
import { fauxAssistantMessage, fauxThinking, fauxToolCall, type Context } from "@earendil-works/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { createQuireAiPiCoordinator } from "./coordinator";
import type { QuireAiAgentTraceEntry } from "./types";
import { createRunRequest, createTestDocument, createTestRuntime } from "./testing/fixtures";

/** @returns A native model call using the published document schema. */
function editResponse() {
  return fauxAssistantMessage([fauxThinking("Use the document tool."), fauxToolCall("document_edit", { value: "new" }, { id: "call-edit" })], { stopReason: "toolUse" });
}

describe("persistent Pi document coordinator", () => {
  it("uses only SDK invocation and preserves the complete native transcript across turns", async () => {
    const contexts: Context[] = [];
    const { runtime, faux } = createTestRuntime([
      editResponse(), fauxAssistantMessage("Finished."),
      context => { contexts.push(context); return fauxAssistantMessage("I remember the edit."); }
    ]);
    const sdk = createTestDocument(async () => ({ value: { applied: true, apiKey: "secret" }, summary: "Applied." }));
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Use the SDK." });
    const traces: QuireAiAgentTraceEntry[] = [];
    const stream: string[] = [];
    const first = await coordinator.run(createRunRequest(sdk.document, { id: "run-1", onTrace: entry => traces.push(entry), onToolCallStream: event => stream.push(event.type) }));
    const second = await coordinator.run(createRunRequest(sdk.document, { id: "run-2" }));
    expect(first.content).toBe("Finished.");
    expect(second.sessionId).toBe(first.sessionId);
    expect(faux.state.callCount).toBe(3);
    expect(sdk.invoke).toHaveBeenCalledOnce();
    expect(sdk.invoke.mock.calls[0]?.[0]).toMatchObject({ toolName: "document_edit", input: { value: "new" }, requestId: "request-1" });
    const operationId = sdk.invoke.mock.calls[0]?.[0].operationId;
    expect(sdk.observeInput.mock.calls.some(([request]) => request.operationId === operationId)).toBe(true);
    expect(contexts[0]?.messages.filter(message => message.role !== "system").map(message => message.role)).toEqual(["user", "assistant", "toolResult", "assistant", "user"]);
    expect(contexts[0]?.messages.find(message => message.role === "assistant")).toMatchObject({ content: expect.arrayContaining([expect.objectContaining({ type: "thinking" }), expect.objectContaining({ type: "toolCall" })]) });
    expect((await coordinator.getTranscript()).map(message => message.role)).toEqual(["user", "assistant", "toolResult", "assistant", "user", "assistant"]);
    expect(stream).toContain("delta");
    expect(JSON.stringify(traces)).toContain("[redacted]");
    expect(JSON.stringify(traces)).not.toContain('"apiKey":"secret"');
    const toolTraces = traces.filter(entry => entry.toolName === "document_edit");
    expect(new Set(toolTraces.map(entry => entry.id)).size).toBe(1);
    expect(new Set(toolTraces.map(entry => entry.operationId))).toEqual(new Set([operationId]));
    expect(toolTraces.at(-1)).toMatchObject({
      kind: "tool-call", status: "succeeded", result: { applied: true, apiKey: "[redacted]" }
    });
    expect(sdk.releaseRequest).toHaveBeenCalledTimes(2);
    await coordinator.close();
  });

  it("rejects pre-cancelled requests before provider calls or target capture", async () => {
    const { runtime, faux } = createTestRuntime([editResponse()]);
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test" });
    const signal = AbortSignal.abort();
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "cancelled", signal }))).rejects.toMatchObject({ code: "cancelled", name: "AbortError" });
    expect(faux.state.callCount).toBe(0);
    expect(sdk.captureRequest).not.toHaveBeenCalled();
    expect(sdk.invoke).not.toHaveBeenCalled();
    await coordinator.close();
  });

  it("keeps a committed write visible as a failed tool result before the model continues", async () => {
    const contexts: Context[] = [];
    const { runtime } = createTestRuntime([editResponse(), context => {
      contexts.push(context);
      return fauxAssistantMessage("The write committed; I must inspect before retrying.");
    }]);
    const sdk = createTestDocument(async () => { throw new Error("PRIVATE-POST-COMMIT-FAILURE"); });
    const document = {
      ...sdk.document,
      getOperation: (id: string) => ({
        id, documentId: "document", toolName: "document_edit", status: "failed" as const, committed: true,
        receipts: [{ toolCallId: "call-edit", capabilityId: "word.edit", mode: "direct" as const, target: { kind: "document", id: "document" }, sourceDocumentRevision: "r1", documentRevision: "r2" }],
        error: { code: "post-commit-failed", message: "Failed after commit." }
      })
    };
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test" });
    await coordinator.run(createRunRequest(document, { id: "partial-commit" }));
    const result = contexts[0]?.messages.find(message => message.role === "toolResult");
    expect(result).toMatchObject({ isError: true });
    expect(JSON.stringify(result)).toContain("Do not repeat the write blindly");
    expect(JSON.stringify(result)).toContain('\\"committed\\":true');
    expect(JSON.stringify(result)).toContain('\\"documentRevision\\":\\"r2\\"');
    expect(JSON.stringify(result)).not.toContain("PRIVATE-POST-COMMIT-FAILURE");
    expect(sdk.invoke).toHaveBeenCalledOnce();
    await coordinator.close();
  });

  it("cancels an approval wait, settles the tool, and accepts a subsequent run", async () => {
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const sdk = createTestDocument(async (_request, options) => {
      started();
      await new Promise<void>((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(options.signal!.reason), { once: true }));
      return { value: null, summary: "Unreachable" };
    });
    const { runtime, faux } = createTestRuntime([editResponse(), fauxAssistantMessage("Ready again.")]);
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test" });
    const run = coordinator.run(createRunRequest(sdk.document, { id: "approval" }));
    await ready;
    coordinator.abort();
    await expect(run).rejects.toMatchObject({ code: "cancelled" });
    expect(faux.state.callCount).toBe(1);
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "next" }))).resolves.toMatchObject({ content: "Ready again." });
    await coordinator.close();
  });

  it("blocks the next model request at budget while preserving a completed write", async () => {
    const { runtime, faux } = createTestRuntime([editResponse(), fauxAssistantMessage("Should not be called")]);
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test", maxModelTurns: 1 });
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "bounded" }))).rejects.toMatchObject({ code: "turn-budget-exceeded" });
    expect(faux.state.callCount).toBe(1);
    expect(sdk.invoke).toHaveBeenCalledOnce();
    expect((await coordinator.getTranscript()).some(message => message.role === "toolResult")).toBe(true);
    await coordinator.close();
  });

  it("stops before another model request when consecutive writes commit nothing", async () => {
    const { runtime, faux } = createTestRuntime([editResponse(), editResponse(), fauxAssistantMessage("Should not be called")]);
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test", maxModelTurns: 8, maxIdleTurns: 2 });
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "stalled" }))).rejects.toMatchObject({ code: "no-progress" });
    expect(faux.state.callCount).toBe(2);
    expect(sdk.invoke).toHaveBeenCalledTimes(2);
    await coordinator.close();
  });

  it("completes a final prose response exactly at the model budget", async () => {
    const { runtime, faux } = createTestRuntime([fauxAssistantMessage("Done.")]);
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test", maxModelTurns: 1 });
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "last-turn" }))).resolves.toMatchObject({ content: "Done.", status: "completed" });
    expect(faux.state.callCount).toBe(1);
    await coordinator.close();
  });

  it("isolates presentation failures from model and document execution", async () => {
    const { runtime } = createTestRuntime([editResponse(), fauxAssistantMessage("Done.")]);
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test" });
    const broken = () => { throw new Error("UI failed"); };
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "ui-errors", onTrace: broken, onContentDelta: broken, onReasoningDelta: broken, onToolCallStream: broken }))).resolves.toMatchObject({ content: "Done." });
    expect(sdk.invoke).toHaveBeenCalledOnce();
    await coordinator.close();
  });

  it("reports provider failures without exposing upstream response bodies to UI", async () => {
    const { runtime } = createTestRuntime([fauxAssistantMessage("", { stopReason: "error", errorMessage: "PRIVATE-UPSTREAM-RESPONSE" })]);
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test" });
    const traces: unknown[] = [];
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "provider-error", onTrace: event => traces.push(event) }))).rejects.toMatchObject({ code: "provider-failed" });
    expect(JSON.stringify(traces)).not.toContain("PRIVATE-UPSTREAM-RESPONSE");
    await coordinator.close();
  });

  it("does not invent a successful response when the model returns no content", async () => {
    const { runtime } = createTestRuntime([fauxAssistantMessage("")]);
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test" });
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "empty" }))).rejects.toMatchObject({ code: "invalid-response" });
    await coordinator.close();
  });

  it("times out a stalled provider with a stable timeout classification", async () => {
    const { runtime } = createTestRuntime([async (_context, options) => {
      await new Promise<void>((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(options.signal!.reason), { once: true }));
      return fauxAssistantMessage("Unreachable");
    }]);
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test", timeoutMs: 15 });
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "idle" }))).rejects.toMatchObject({ code: "timeout" });
    await coordinator.close();
  });

  it("does not spend provider idle budget while awaiting document approval", async () => {
    const { runtime } = createTestRuntime([editResponse(), fauxAssistantMessage("Approved.")]);
    const sdk = createTestDocument(async () => {
      await new Promise(resolve => setTimeout(resolve, 45));
      return { value: null, summary: "Applied after approval" };
    });
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test", timeoutMs: 25 });
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "human-wait" }))).resolves.toMatchObject({ content: "Approved." });
    await coordinator.close();
  });

  it("reserves asynchronous initialization and resets into a new conversation", async () => {
    const { runtime } = createTestRuntime([fauxAssistantMessage("First"), fauxAssistantMessage("Second")]);
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test" });
    const first = coordinator.run(createRunRequest(sdk.document, { id: "first" }));
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "parallel" }))).rejects.toMatchObject({ code: "busy" });
    const result = await first;
    await coordinator.reset();
    const next = await coordinator.run(createRunRequest(sdk.document, { id: "second" }));
    expect(next.sessionId).not.toBe(result.sessionId);
    expect(await coordinator.getTranscript()).toHaveLength(2);
    await coordinator.close();
    await expect(coordinator.run(createRunRequest(sdk.document, { id: "closed" }))).rejects.toMatchObject({ code: "closed" });
  });

  it("reopens a supplied native session without synthesizing assistant or tool messages", async () => {
    const repository = new MemorySessionRepo();
    let metadata: SessionMetadata | undefined;
    const openSession = vi.fn(async ({ fresh }: { fresh: boolean }) => {
      const session = metadata === undefined || fresh ? await repository.create({}, BACKGROUND_CONTEXT) : await repository.open(metadata, BACKGROUND_CONTEXT);
      metadata = session.metadata;
      return session;
    });
    const firstRuntime = createTestRuntime([editResponse(), fauxAssistantMessage("Stored.")]);
    const sdk = createTestDocument();
    const first = createQuireAiPiCoordinator({ ...firstRuntime.runtime, systemPrompt: "Test", openSession });
    const result = await first.run(createRunRequest(sdk.document, { id: "stored" }));
    const transcript = await first.getTranscript();
    await first.close();
    const secondRuntime = createTestRuntime([fauxAssistantMessage("Recovered.")]);
    const second = createQuireAiPiCoordinator({ ...secondRuntime.runtime, systemPrompt: "Test", openSession });
    expect(await second.getTranscript()).toEqual(transcript);
    expect(await second.getSessionId()).toBe(result.sessionId);
    await second.run(createRunRequest(sdk.document, { id: "recovered" }));
    await second.reset();
    await second.getSessionId();
    expect(openSession.mock.calls.at(-1)?.[0].fresh).toBe(true);
    await second.close();
    await repository.close(BACKGROUND_CONTEXT);
  });

  it("changes native model runtime without replacing transcript", async () => {
    const firstRuntime = createTestRuntime([fauxAssistantMessage("First provider.")], "first");
    const secondRuntime = createTestRuntime([context => {
      expect(context.messages.find(message => message.role === "assistant")).toMatchObject({ role: "assistant", provider: "first" });
      return fauxAssistantMessage("Second provider.");
    }], "second");
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...firstRuntime.runtime, systemPrompt: "Test" });
    const first = await coordinator.run(createRunRequest(sdk.document, { id: "profile-1" }));
    const second = await coordinator.run(createRunRequest(sdk.document, { id: "profile-2", runtime: secondRuntime.runtime }));
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.content).toBe("Second provider.");
    await coordinator.close();
  });

  it("refuses to send another document's transcript before model egress", async () => {
    const { runtime, faux } = createTestRuntime([fauxAssistantMessage("Bound.")]);
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test" });
    await coordinator.run(createRunRequest(sdk.document, { id: "bind-document" }));
    await expect(coordinator.run(createRunRequest({ ...sdk.document, documentId: "another-document" }, { id: "different" }))).rejects.toMatchObject({ code: "document-mismatch" });
    expect(faux.state.callCount).toBe(1);
    await coordinator.close();
  });

  it("reconciles interrupted stored operations without running their old prompt", async () => {
    const repository = new MemorySessionRepo();
    const session = await repository.create({}, BACKGROUND_CONTEXT);
    const { runtime, faux } = createTestRuntime([fauxAssistantMessage("Only the new request ran.")]);
    const { harness } = await AgentHarness.create({ session, models: runtime.models, model: runtime.model }, BACKGROUND_CONTEXT);
    const lane = await harness.lane("document", BACKGROUND_CONTEXT);
    await lane.accept({ kind: "prompt", prompt: "Old unfinished edit", operationId: "interrupted" }, BACKGROUND_CONTEXT);
    await harness.close(BACKGROUND_CONTEXT);
    const sdk = createTestDocument();
    const coordinator = createQuireAiPiCoordinator({ ...runtime, systemPrompt: "Test", openSession: () => repository.open(session.metadata, BACKGROUND_CONTEXT) });
    const result = await coordinator.run(createRunRequest(sdk.document, { id: "after-recovery" }));
    expect(result.content).toBe("Only the new request ran.");
    expect(faux.state.callCount).toBe(1);
    expect(sdk.invoke).not.toHaveBeenCalled();
    await coordinator.close();
    await repository.close(BACKGROUND_CONTEXT);
  });
});

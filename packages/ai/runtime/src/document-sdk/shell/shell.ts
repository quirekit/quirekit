import { Check } from "typebox/value";
import type { QuireDocumentTool, QuireDocumentToolContext, QuireDocumentToolDescriptor } from "../../document-tools";
import { QuireDocumentSdkError } from "../error";
import { copyDocumentInvocation } from "../invocation";
import { copyDocumentJson, documentJsonKey } from "../json";
import { createDocumentOperations } from "../operations/store";
import type { DocumentRequestState } from "../requests/types";
import type { QuireDocumentEvent, QuireDocumentSdk } from "../types";
import { describeQuireSchemaMismatch } from "../validation";
import { enqueueDocumentWrite } from "../write-queue";
import type { QuireDocumentSdkEngine, QuireDocumentSdkEnginePorts, QuireDocumentSdkShellOptions } from "./types";

/**
 * Builds the public document SDK on one document engine.
 *
 * The shell owns what every document model shares: operation identity and deduplication, schema
 * validation, write serialization, events and the SDK lifetime. Requests, writes and reviews belong
 * to the engine, which the shell creates once with its event and receipt ports.
 *
 * @param options - Document identity and application policy.
 * @param createEngine - Creates the engine with the shell's ports.
 * @returns The same document API for direct workflows and arbitrary Agent runtimes.
 */
export function createDocumentSdkShell(options: QuireDocumentSdkShellOptions,
  createEngine: (ports: QuireDocumentSdkEnginePorts) => QuireDocumentSdkEngine): QuireDocumentSdk {
  if (!options.documentId.trim()) throw new QuireDocumentSdkError("invalid-document", "A document identity is required.");
  let disposed = false;
  const listeners = new Set<(event: QuireDocumentEvent) => void>();
  /** Publishes detached facts without granting subscribers command authority. @param event - Protocol fact. */
  function emit(event: QuireDocumentEvent): void {
    const value = copyDocumentJson(event);
    for (const listener of listeners) { try { listener(value); } catch { /* Observers do not veto execution. */ } }
  }
  const operations = createDocumentOperations(options.documentId, emit);
  const engine = createEngine({ emit, receipt: operations.receipt });
  const { requests, previews } = engine;
  /** Rejects work after document ownership ends. */
  function assertOpen(): void {
    if (disposed || !engine.isOpen()) throw new QuireDocumentSdkError("disposed", "The document SDK is closed.");
  }
  /** @param state - Live request. @param name - Discovered tool name. @returns Authorized feature handler. */
  function resolveTool(state: DocumentRequestState, name: string): QuireDocumentTool {
    assertOpen();
    if (options.authorizeRead?.(name) === false) throw new QuireDocumentSdkError("permission-denied", "Document access was denied.");
    const tool = state.tools.find(item => item.name === name);
    if (tool === undefined) throw new QuireDocumentSdkError("unknown-tool", "The requested document tool is not mounted.");
    return tool;
  }
  /** @param state - Request target. @param callId - Logical operation. @param signal - Cancellation. @returns Trusted context. */
  function context(state: DocumentRequestState, callId: string, signal: AbortSignal): QuireDocumentToolContext {
    signal.throwIfAborted();
    return { callId, requestId: state.identity.id, signal, selection: state.selection,
      onProgress: progress => { signal.throwIfAborted(); emit({ type: "progress", operationId: callId, progress }); } };
  }
  /** Cancels all document work and detaches lifecycle subscriptions. */
  function destroy(): void {
    if (disposed) return;
    disposed = true;
    operations.destroy();
    previews.destroy();
    engine.destroy();
    requests.destroy();
    detach();
    listeners.clear();
  }
  const detach = engine.onDestroy(destroy);
  return Object.freeze({
    documentId: options.documentId,
    /** @param requestId - Optional captured request. @returns Serializable tool descriptors. */
    tools(requestId?: string): readonly QuireDocumentToolDescriptor[] {
      assertOpen();
      const state = requestId === undefined ? requests.capture() : requests.get(requestId);
      try {
        return copyDocumentJson(state.tools.filter(tool => tool.effect === "read" || engine.isEditable()).map(tool => ({ name: tool.name, label: tool.label, description: tool.description,
          parameters: tool.parameters, ...(tool.outputSchema === undefined ? {} : { outputSchema: tool.outputSchema }), effect: tool.effect })));
      } finally { if (requestId === undefined) requests.release(state.identity.id); }
    },
    /** @returns Request identity whose original selection remains privately mapped. */
    captureRequest() { assertOpen(); return requests.capture().identity; },
    /** @param requestId - Request to release after its calls settle. */
    releaseRequest(requestId: string): void { requests.release(requestId); },
    /** @param invocation - Serializable operation. @param controls - Local cancellation. @returns Deduplicated JSON result. */
    async invoke(invocation, controls = {}) {
      assertOpen();
      const input = copyDocumentInvocation(invocation);
      const fingerprint = documentJsonKey(input);
      const existing = operations.existing(input.operationId, fingerprint);
      if (existing !== undefined) return existing;
      return operations.start(input.operationId, input.toolName, fingerprint, controls.signal, async signal => {
        const state = input.requestId === undefined ? requests.capture() : requests.get(input.requestId);
        try {
          const tool = resolveTool(state, input.toolName);
          if (!Check(tool.parameters, input.input)) {
            throw new QuireDocumentSdkError("invalid-input", `Tool arguments do not match the declared schema: ${describeQuireSchemaMismatch(tool.parameters, input.input)}.`);
          }
          /** Revalidates access and mapped targets after any write-queue wait. @returns The feature's validated result. */
          async function execute() {
            resolveTool(requests.get(state.identity.id), input.toolName);
            const result = copyDocumentJson(await tool.execute(input.input, context(state, input.operationId, signal)));
            if (tool.outputSchema !== undefined && !Check(tool.outputSchema, result.value)) throw new QuireDocumentSdkError("invalid-output", "The document tool returned an invalid result.");
            return result;
          }
          return await (tool.effect === "write" ? enqueueDocumentWrite(engine.writeKey, signal, execute) : execute());
        } finally { if (input.requestId === undefined) requests.release(state.identity.id); }
      });
    },
    /** @param invocation - Partial arguments with a captured request. @param controls - Local cancellation. */
    observeInput(invocation, controls = {}): void {
      assertOpen();
      if (invocation.requestId === undefined) throw new QuireDocumentSdkError("missing-request", "Streaming input requires a captured request.");
      const state = requests.get(invocation.requestId);
      const tool = resolveTool(state, invocation.toolName);
      const signal = controls.signal ?? new AbortController().signal;
      tool.observeInput?.(copyDocumentJson(invocation.input), context(state, invocation.operationId, signal));
    },
    /** @param invocation - Complete arguments with an optional captured request. @returns Why they do not fit the tool, or undefined. */
    checkInput(invocation) {
      assertOpen();
      const state = invocation.requestId === undefined ? requests.capture() : requests.get(invocation.requestId);
      try {
        const tool = resolveTool(state, invocation.toolName);
        return Check(tool.parameters, invocation.input)
          ? undefined
          : `Tool arguments do not match the declared schema: ${describeQuireSchemaMismatch(tool.parameters, invocation.input)}. Nothing was changed.`;
      } finally {
        if (invocation.requestId === undefined) requests.release(state.identity.id);
      }
    },
    getOperation: operations.get,
    /** @param listener - Fact observer. @returns Idempotent unsubscribe function. */
    subscribe(listener) { assertOpen(); listeners.add(listener); return () => { listeners.delete(listener); }; },
    decidePreview: previews.decide,
    /** @param requestId - Finished request. @returns Whether a review of its changes was opened. */
    reviewRequest(requestId) { assertOpen(); return previews.present(requestId); },
    /** @param text - Assistant text. @param language - Reply language, or detected from the text. @returns Text without internal ids. */
    presentReply(text, language) {
      if (disposed || options.presentReply === undefined) return text;
      return options.presentReply(text, language ?? (/[㐀-鿿]/u.test(text) ? "zh" : "en"));
    },
    cancel: operations.cancel,
    destroy
  } satisfies QuireDocumentSdk);
}

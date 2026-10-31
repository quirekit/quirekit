import type { AgentHarnessTool } from "@earendil-works/pi-agent-core";
import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import type { QuireDocumentSdk } from "@quirekit/ai-runtime";
import { committedDocumentToolFailure } from "./failure";

/**
 * Creates an SDK operation identity shared by partial input and final execution.
 * @param sessionId - Native conversation identity.
 * @param runId - Caller-owned run identity.
 * @param toolCallId - Provider-issued identity within this run.
 * @returns Opaque stable document operation identity.
 */
export function documentOperationId(sessionId: string, runId: string, toolCallId: string): string {
  return JSON.stringify([sessionId, runId, toolCallId]);
}

/**
 * Projects public descriptors into Pi tools without acquiring feature authority.
 * @param document - Engine-neutral document SDK.
 * @param sessionId - Native conversation identity.
 * @param runId - Stable run identity.
 * @param requestId - Captured document request.
 * @param signal - Run cancellation, including admission-time cancellation.
 * @returns Pi-owned tool ABI delegating every invocation to the SDK.
 */
export function createDocumentPiTools(
  document: QuireDocumentSdk,
  sessionId: string,
  runId: string,
  requestId: string,
  signal: AbortSignal
): AgentHarnessTool<undefined>[] {
  return document.tools(requestId).map(descriptor => ({
    name: descriptor.name,
    label: descriptor.label,
    description: descriptor.description,
    parameters: descriptor.parameters,
    executionMode: "sequential",
    replay: "never",
    // Runs before Pi's own schema check, so a rejected call gets the SDK's precise
    // explanation (which operation and field) instead of a generic union mismatch
    // followed by an echo of every argument.
    prepareArguments(args: unknown) {
      const problem = document.checkInput({ toolName: descriptor.name, input: args, operationId: "", requestId });
      if (problem !== undefined) throw new Error(problem);
      return args as never;
    },
    async execute(toolCallId, input, onUpdate, _toolContext, _invocation, context) {
      const operationId = documentOperationId(sessionId, runId, toolCallId);
      const executionSignal = context.abortSignal === undefined ? signal : AbortSignal.any([signal, context.abortSignal]);
      const unsubscribe = document.subscribe((event) => {
        if (event.type !== "progress" || event.operationId !== operationId) return;
        onUpdate({
          content: [{ type: "text", text: event.progress.summary ?? "Generating document content." }],
          details: event.progress
        });
      });
      try {
        executionSignal.throwIfAborted();
        const result = await document.invoke({
          toolName: descriptor.name, input, operationId, requestId
        }, { signal: executionSignal });
        return { content: [{ type: "text", text: result.summary }], details: result.value };
      } catch (error) {
        if (executionSignal.aborted) throw error;
        throw committedDocumentToolFailure(document, operationId) ?? error;
      } finally {
        unsubscribe();
      }
    }
  }));
}

/**
 * Passes Pi's already parsed partial arguments to the detached SDK progress seam.
 * @param event - Native provider event; Pi remains JSON accumulation authority.
 * @param document - Public document SDK.
 * @param sessionId - Native conversation identity.
 * @param runId - Stable run identity.
 * @param requestId - Captured request.
 * @param signal - Caller cancellation.
 */
export function observeDocumentPiInput(
  event: AssistantMessageEvent,
  document: QuireDocumentSdk,
  sessionId: string,
  runId: string,
  requestId: string,
  signal: AbortSignal
): void {
  if (signal.aborted || (event.type !== "toolcall_delta" && event.type !== "toolcall_end")) return;
  const call = event.type === "toolcall_end" ? event.toolCall : event.partial.content[event.contentIndex];
  if (call?.type !== "toolCall") return;
  document.observeInput({
    toolName: call.name,
    input: call.arguments,
    operationId: documentOperationId(sessionId, runId, call.id),
    requestId
  }, { signal });
}

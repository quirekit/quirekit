import { QuireAiToolWriteError, type QuireAiToolWriteReceipt } from "../../tool-host";
import type { QuireDocumentToolResult } from "../../document-tools";
import { QuireDocumentSdkError } from "../error";
import { copyDocumentJson } from "../json";
import type { QuireDocumentEvent, QuireDocumentOperation } from "../types";
import type { DocumentOperationRecord } from "./types";

/**
 * Keeps logical executions and canonical commits as independent facts.
 * @param documentId - Application document identity.
 * @param emit - Isolated event publisher.
 * @returns Memory-scoped idempotency and lifecycle store.
 */
export function createDocumentOperations(documentId: string, emit: (event: QuireDocumentEvent) => void) {
  const records = new Map<string, DocumentOperationRecord>();
  /** @param record - Internal record. @param update - New facts. */
  function update(record: DocumentOperationRecord, update: Partial<QuireDocumentOperation>): void {
    record.state = copyDocumentJson({ ...record.state, ...update });
    emit({ type: "operation", operation: record.state });
  }
  return {
    /** @param id - Logical operation. @returns Latest immutable facts. */
    get(id: string): QuireDocumentOperation | undefined { return records.get(id)?.state; },
    /** @param id - Logical operation. @param fingerprint - Invocation payload. @returns Previously admitted promise. */
    existing(id: string, fingerprint: string): Promise<QuireDocumentToolResult> | undefined {
      const record = records.get(id);
      if (record !== undefined && record.fingerprint !== fingerprint) throw new QuireDocumentSdkError("operation-conflict", "An operation identity cannot be reused with different arguments.");
      return record?.promise;
    },
    /**
     * Admits one invocation before any feature can commit.
     * @param id - Logical operation identity.
     * @param toolName - Discovered tool name.
     * @param fingerprint - Immutable invocation fingerprint.
     * @param signal - Optional caller cancellation.
     * @param execute - Validated feature dispatch.
     * @returns Shared result for this operation and every matching retry.
     */
    start(id: string, toolName: string, fingerprint: string, signal: AbortSignal | undefined,
      execute: (signal: AbortSignal) => Promise<QuireDocumentToolResult>): Promise<QuireDocumentToolResult> {
      const controller = new AbortController();
      /** Relays cancellation without trusting a provider's error detail. */
      function abort(): void { controller.abort(); }
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      const state: QuireDocumentOperation = copyDocumentJson({ id, documentId, toolName, status: "running", committed: false, receipts: [] });
      const promise = Promise.resolve().then(async () => {
        controller.signal.throwIfAborted();
        const result = copyDocumentJson(await execute(controller.signal));
        controller.signal.throwIfAborted();
        update(record, { status: "completed", result });
        return result;
      }).catch((error: unknown) => {
        const cancelled = controller.signal.aborted;
        const failure = cancelled ? { code: "cancelled", message: "The document operation was cancelled." }
          : error instanceof QuireDocumentSdkError || error instanceof QuireAiToolWriteError
            ? { code: error.code, message: error.message }
            : { code: "tool-failed", message: "The document tool failed. Inspect its operation receipts before retrying." };
        update(record, { status: cancelled ? "cancelled" : "failed", error: failure });
        throw new QuireDocumentSdkError(failure.code, failure.message);
      }).finally(() => signal?.removeEventListener("abort", abort));
      const record: DocumentOperationRecord = { fingerprint, controller, promise, state };
      records.set(id, record);
      emit({ type: "operation", operation: state });
      return promise;
    },
    /** @param receipt - Canonical effect observed at the command boundary. */
    receipt(receipt: QuireAiToolWriteReceipt): void {
      const record = records.get(receipt.toolCallId);
      if (record === undefined) return;
      const value = copyDocumentJson(receipt);
      update(record, { committed: true, receipts: [...record.state.receipts, value] });
      emit({ type: "receipt", operationId: receipt.toolCallId, receipt: value });
    },
    /** @param id - Logical operation. @returns Whether running work was cancelled. */
    cancel(id: string): boolean {
      const record = records.get(id);
      if (record === undefined || record.state.status !== "running" || record.controller.signal.aborted) return false;
      record.controller.abort();
      return true;
    },
    /** Cancels active work while retaining effects for final reconciliation. */
    destroy(): void { for (const record of records.values()) if (record.state.status === "running") record.controller.abort(); }
  };
}

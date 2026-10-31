import { createQuireAiCommandContext } from "./authorization";
import type { Transaction } from "@quirekit/pm";
import { createQuireAiDocumentRevision } from "./revision";
import { QuireAiToolWriteError, type QuireAiToolHostOptions, type QuireAiToolWriteMode,
  type QuireAiToolWriteReceipt, type QuireAiToolWriteRequest, type QuireAiToolWriteResult } from "./types";

/**
 * Records canonical effects even when a command or its caller subsequently fails.
 * @param options - Canonical editor and receipt observer.
 * @param request - Authorized command binding.
 * @param mode - Revalidated materialization policy.
 * @param sourceDocumentRevision - Document endpoint immediately before commit.
 * @param untracked - Whether this direct write replaces a tracked one and stays outside revisions and review.
 * @returns Canonical commit facts or a no-change result.
 */
export function commitQuireAiWrite(options: QuireAiToolHostOptions, request: QuireAiToolWriteRequest,
  mode: QuireAiToolWriteMode, sourceDocumentRevision: string, untracked = false): QuireAiToolWriteResult {
  let accepted = false;
  let receipt: QuireAiToolWriteReceipt | null = null;
  try {
    accepted = request.apply(options.editor, createQuireAiCommandContext(options, request, mode));
  } finally {
    const documentRevision = createQuireAiDocumentRevision(options.editor.state.doc);
    if (documentRevision !== sourceDocumentRevision) {
      receipt = Object.freeze({ toolCallId: request.toolCallId, capabilityId: request.capabilityId,
        mode, target: request.target, sourceDocumentRevision, documentRevision, ...(untracked ? { untracked: true as const } : {}) });
      // Observers report an existing effect; they cannot veto or obscure that effect.
      try { options.onReceipt?.(receipt); } catch { /* Observer failure cannot undo a commit. */ }
    }
  }
  if (receipt !== null) return Object.freeze({ applied: true, receipt });
  if (!accepted) throw new QuireAiToolWriteError("command-rejected", `Command rejected ${request.capabilityId} without changing the document.`);
  return Object.freeze({ applied: false, receipt: null, reason: "unchanged" });
}

/**
 * Writes directly a change the revision system refused, collecting the transactions it applies.
 * @param options - Canonical editor and observers.
 * @param request - Authorized command binding.
 * @param sourceDocumentRevision - Document endpoint immediately before commit.
 * @param revertible - Whether to hand the transactions to `onDirectFallback` for the request review.
 * @returns Canonical commit facts or a no-change result.
 */
export function commitQuireAiDirectFallback(options: QuireAiToolHostOptions, request: QuireAiToolWriteRequest,
  sourceDocumentRevision: string, revertible: boolean): QuireAiToolWriteResult {
  const transactions: Transaction[] = [];
  const collect = ({ transaction, appendedTransactions }: { transaction: Transaction; appendedTransactions: readonly Transaction[] }) => {
    transactions.push(transaction, ...appendedTransactions);
  };
  options.editor.on("transaction", collect);
  let result: QuireAiToolWriteResult;
  try {
    // A write the request review can take back is part of that review, not left outside it.
    result = commitQuireAiWrite(options, request, "direct", sourceDocumentRevision, !revertible);
  } finally {
    options.editor.off("transaction", collect);
  }
  if (result.applied && revertible) {
    try { options.onDirectFallback?.({ executionId: request.executionId ?? null, transactions }); } catch { /* An observer cannot undo a commit. */ }
  }
  return result;
}

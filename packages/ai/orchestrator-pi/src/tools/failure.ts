import type { QuireDocumentSdk } from "@quirekit/ai-runtime";

/**
 * Preserves committed document facts in Pi's native failed-tool transcript.
 * @param document - SDK retaining canonical receipts independently of failure.
 * @param operationId - Failed logical invocation.
 * @returns Safe tool error requiring inspection, or undefined if nothing committed.
 */
export function committedDocumentToolFailure(document: QuireDocumentSdk, operationId: string): Error | undefined {
  const operation = document.getOperation(operationId);
  if (operation?.committed !== true) return undefined;
  const facts = {
    operationId,
    status: operation.status,
    committed: true,
    errorCode: operation.error?.code,
    receipts: operation.receipts
  };
  return new Error(`The document tool failed after committing changes. Do not repeat the write blindly. Inspect the current document before deciding what remains to be done. Commit facts: ${JSON.stringify(facts)}`);
}

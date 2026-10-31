import type { QuireAiAgentTraceEntry, QuireAiPiRunRequest } from "../types";

/**
 * Emits one immutable trace snapshot without giving presentation authority.
 *
 * @param request - Current run.
 * @param entry - Trace snapshot.
 */
export function emitTrace(
  request: QuireAiPiRunRequest,
  entry: QuireAiAgentTraceEntry
): void {
  observePresentation(request.onTrace, Object.freeze(entry));
}

/**
 * Isolates presentation listeners from provider and document execution.
 * @param listener - Optional application observer.
 * @param value - Immutable or scalar presentation value.
 */
export function observePresentation<Value>(listener: ((value: Value) => void) | undefined, value: Value): void {
  try {
    listener?.(value);
  } catch {
    // Presentation observers never affect model or document authority.
  }
}

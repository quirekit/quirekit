import type { QuireAiTraceProgressState } from "./types";

/**
 * Creates transport-progress state isolated to one Agent run.
 *
 * @param operationId - Adapter-owned tool-to-document identity mapping.
 * @returns Empty trace timing and Tool-call counters.
 */
export function createQuireAiTraceProgressState(operationId: (toolCallId: string) => string): QuireAiTraceProgressState {
  return {
    operationId,
    starts: new Map<string, number>(),
    toolCalls: new Map()
  };
}

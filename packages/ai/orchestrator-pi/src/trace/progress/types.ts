/** Mutable transport-progress counters retained for one Agent run. */
export interface QuireAiTraceProgressState {
  /** Resolve the exact SDK identity without exposing native ID conventions to UI.
   * @param toolCallId - Provider-owned tool call identity.
   * @returns Opaque document operation identity.
   */
  readonly operationId: (toolCallId: string) => string;
  /** Shared lifecycle start times. */
  readonly starts: Map<string, number>;
  /** Native Tool-call argument progress keyed by provider call identity. */
  readonly toolCalls: Map<string, QuireAiToolCallProgress>;
}

/** Mutable argument counters for one native Pi Tool call. */
export interface QuireAiToolCallProgress {
  /** Exact model-visible Tool name. */
  readonly name: string;
  /** Received native argument delta count. */
  chunks: number;
  /** Received native argument character count. */
  characters: number;
  /** Character count at the most recent trace update. */
  emitted: number;
}

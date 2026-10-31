import type { AiChatSnapshot } from "../types";

/** Mutable controller internals; framework adapters receive only snapshots. */
export interface ChatState {
  /** Immutable published value. */
  snapshot: AiChatSnapshot;
  /** Active turn cancellation and identity. */
  active: { controller: AbortController; messageId: string; settled?: Promise<void> | undefined } | undefined;
  /** Final teardown prevents late events and new submissions. */
  destroyed: boolean;
  /** Snapshot listeners owned by mounted consumers. */
  readonly listeners: Set<(snapshot: AiChatSnapshot) => void>;
}

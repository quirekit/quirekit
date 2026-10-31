import type { StateEffect } from "@quirekit/cm-state";

/** Inverse of the non-text effects of an AI transaction, mapped through every later change. */
export interface MsfeAiStateInverse {
  /** Effects restoring the state before the transaction. */
  effects: readonly StateEffect<unknown>[];
}


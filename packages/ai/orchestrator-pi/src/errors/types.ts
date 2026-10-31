/** Stable failures suitable for localized presentation without parsing provider text. */
export type QuireAiPiErrorCode = "cancelled" | "timeout" | "turn-budget-exceeded" | "no-progress"
  | "provider-failed" | "session-failed" | "invalid-response" | "document-mismatch" | "busy" | "closed";

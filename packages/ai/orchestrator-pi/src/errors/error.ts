import type { QuireAiPiErrorCode } from "./types";

/** Safe execution failure preserving its machine-readable classification. */
export class QuireAiPiError extends Error {
  /** Stable presentation code. */
  readonly code: QuireAiPiErrorCode;

  /**
   * Creates a safe coordinator failure.
   * @param code - Stable execution failure.
   * @param message - Public explanation without provider response bodies.
   */
  constructor(code: QuireAiPiErrorCode, message: string) {
    super(message);
    this.name = code === "cancelled" ? "AbortError" : "QuireAiPiError";
    this.code = code;
  }
}

/** Stable, safe error returned through every document integration. */
export class QuireDocumentSdkError extends Error {
  /**
   * Creates one public document failure.
   * @param code - Stable failure classification.
   * @param message - Safe caller-visible explanation.
   */
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "QuireDocumentSdkError";
  }
}

import type { QuireDocumentToolResult } from "../../document-tools";
import type { QuireDocumentOperation } from "../types";

/** Internal execution record; promises and controllers never enter the protocol. */
export interface DocumentOperationRecord {
  /** Canonical invocation fingerprint used to reject identity reuse. */
  readonly fingerprint: string;
  /** Cancellation authority for this logical operation. */
  readonly controller: AbortController;
  /** Stable pending or settled invocation promise. */
  readonly promise: Promise<QuireDocumentToolResult>;
  /** Latest immutable state. */
  state: QuireDocumentOperation;
}

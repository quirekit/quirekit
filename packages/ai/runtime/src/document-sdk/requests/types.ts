import type { QuireDocumentTool, QuireDocumentToolSelection } from "../../document-tools";
import type { QuireDocumentRequest } from "../types";

/** Request-owned feature instances and mapped target. */
export interface DocumentRequestState {
  /** Serializable public request identity. */
  readonly identity: QuireDocumentRequest;
  /** Features mounted when the request was captured. */
  readonly tools: readonly QuireDocumentTool[];
  /** Mapped original selection, or null after its original content was changed. */
  selection: QuireDocumentToolSelection | null;
}

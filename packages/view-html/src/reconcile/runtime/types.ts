import type {
  HtmlDescriptorDiagnostic,
  HtmlDescriptorSourceResolver
} from "../../descriptors";
import type { HtmlDomPatchHost, MutableHtmlReconcileTrace } from "../types";
import type { HtmlNodeViewEnvironment } from "../../node-view/types";

/** Mutable state shared by bounded dirty-container passes. */
export interface HtmlReconcileContext {
  /** Whether a child topology or custom-view owner requires fresh DOM indexes. */
  ownershipChanged: boolean;
  /** Browser document used for new schema shells. */
  readonly ownerDocument: Document;
  /** Monotonic document-owned descriptor allocator. */
  readonly allocateId: () => string;
  /** Narrow DOM mutation host. */
  readonly patchHost: HtmlDomPatchHost;
  /** Exact reconciliation trace shared by all bounded child passes. */
  readonly trace: MutableHtmlReconcileTrace;
  /** Mutable schema and ownership diagnostic output. */
  readonly diagnostics: HtmlDescriptorDiagnostic[];
  /** Optional resolver for explicit node-supplied source identity. */
  readonly resolveSource?: HtmlDescriptorSourceResolver | undefined;
  /** Optional exact node and mark factory environment. */
  readonly nodeViewEnvironment?: HtmlNodeViewEnvironment | undefined;
  /** Whether NodeView decoration props changed for this reconciliation pass. */
  readonly decorationsChanged: boolean;
}

/** Context required to create one unmatched retained target. */
export interface HtmlTargetCreationContext {
  /** Browser document used for schema DOM creation. */
  readonly ownerDocument: Document;
  /** Monotonic document-owned descriptor allocator. */
  readonly allocateId: () => string;
  /** Mutable schema and ownership diagnostic output. */
  readonly diagnostics: HtmlDescriptorDiagnostic[];
  /** Optional resolver for explicit node-supplied source identity. */
  readonly resolveSource?: HtmlDescriptorSourceResolver | undefined;
  /** Optional exact node and mark factory environment. */
  readonly nodeViewEnvironment?: HtmlNodeViewEnvironment | undefined;
}

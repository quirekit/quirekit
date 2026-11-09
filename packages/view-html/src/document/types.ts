import type { QuireChangedRange } from "@quirekit/core";
import type { Mapping, Node as ProseMirrorNode } from "@quirekit/pm";
import type { QuireImePreedit } from "@quirekit/view-engine";
import type {
  QuireLayoutSourceRef
} from "@quirekit/layout/identity";
import type {
  HtmlCompositionDesc,
  HtmlCompositionPresentation,
  HtmlDescriptor,
  HtmlDescriptorCreationResult,
  HtmlDescriptorSourceResolver,
  HtmlDocumentDesc,
  HtmlTextDesc
} from "../descriptors/types";
import type { HtmlMeasuredClientRect } from "../measurement/types";
import type { HtmlReconcileResult } from "../reconcile/types";
import type { HtmlNodeViewEnvironment } from "../node-view/types";

/** Creation result returned for the retained HTML document root. */
export type HtmlDocumentDescriptorCreationResult =
  HtmlDescriptorCreationResult<HtmlDocumentDesc>;

/** Inputs used to create one persistent retained HTML document facade. */
export interface CreateHtmlRetainedDocumentViewOptions {
  /** Stable identity of the immortal document descriptor. */
  readonly id: string;
  /** Initial canonical ProseMirror document. */
  readonly documentNode: ProseMirrorNode;
  /** Browser document used to create schema-owned DOM. */
  readonly ownerDocument: Document;
  /** Canonical source identity inherited by ordinary descendants. */
  readonly source: QuireLayoutSourceRef;
  /** Optional resolver for genuinely distinct node-supplied source identities. */
  readonly resolveSource?: HtmlDescriptorSourceResolver | undefined;
  /** Optional exact node and mark factory environment. */
  readonly nodeViewEnvironment?: HtmlNodeViewEnvironment | undefined;
}

/** Inputs for one persistent retained document update. */
export interface HtmlDocumentUpdateOptions {
  /** Next canonical ProseMirror document. */
  readonly documentNode: ProseMirrorNode;
  /** Mapping from the facade's current document to the next document. */
  readonly mapping: Mapping;
  /** Typed changed ranges for the mapped transaction batch. */
  readonly changedRanges: readonly QuireChangedRange[];
}

/** Descriptor-owned DOM point for a canonical document position. */
export interface HtmlDomPoint {
  /** Owned DOM node that realizes the point. */
  readonly node: Node;
  /** DOM offset within the owned node. */
  readonly offset: number;
  /** Retained descriptor that authoritatively resolved the point. */
  readonly descriptorId: string;
}

/** Diagnostics emitted by one retained HTML composition runtime. */
export interface HtmlDocumentCompositionDiagnostics {
  /** Number of sessions ended because canonical DOM ownership was unavailable. */
  readonly gaps: number;
}

/** Result of synchronizing one in-flow preedit. */
export interface HtmlCompositionSyncResult {
  /** Whether a composition descriptor remains attached after synchronization. */
  readonly active: boolean;
  /** Number of direct transient DOM writes performed by this synchronization. */
  readonly writes: number;
}

/** Original retained text value restored before reconciliation or cancellation. */
export interface HtmlCompositionTextSnapshot {
  /** Retained text descriptor whose mounted node was patched. */
  readonly descriptor: HtmlTextDesc;
  /** Exact canonical text value before composition attachment. */
  readonly value: string;
}

/** Browser products and source values owned by one attached preedit. */
export interface HtmlAttachedComposition {
  /** Active transient descriptor. */
  readonly descriptor: HtmlCompositionDesc;
  /** Current canonical preedit request. */
  readonly preedit: QuireImePreedit;
  /** Retained text values patched while the transient descriptor is attached. */
  readonly snapshots: readonly HtmlCompositionTextSnapshot[];
  /** Transient suffix preserving unselected text after the preedit. */
  readonly suffixDOM: Text | undefined;
  /** Text node split by the preedit and its boundaries in canonical text offsets, when a text node hosts it. */
  readonly anchor: HtmlCompositionAnchor | undefined;
}

/** Canonical text node that a preedit splits into a prefix and a suffix. */
export interface HtmlCompositionAnchor {
  /** Node reduced to the prefix while the preedit is attached. */
  readonly node: Node;
  /** Canonical text offset where the preedit starts. */
  readonly start: number;
  /** Canonical text offset where the suffix resumes. */
  readonly end: number;
}

/** Inputs used to realize one transient descriptor in retained DOM flow. */
export interface AttachHtmlCompositionDomOptions {
  /** Retained document that resolves canonical ownership. */
  readonly documentView: HtmlRetainedDocumentView;
  /** Canonical measurement owner used to resolve one retained DOM point. */
  readonly resolveDomPoint: (pos: number, side?: number) => HtmlDomPoint;
  /** Browser document used to create transient DOM. */
  readonly ownerDocument: Document;
  /** Stable descriptor identity for the current composition session. */
  readonly descriptorId: string;
  /** Current canonical preedit request. */
  readonly preedit: QuireImePreedit;
  /** Semantic surface presentation for the preedit. */
  readonly presentation: HtmlCompositionPresentation;
}

/** Result of realizing one transient descriptor in retained DOM flow. */
export interface HtmlCompositionAttachmentResult {
  /** Attached composition session. */
  readonly session: HtmlAttachedComposition;
  /** Number of direct transient DOM writes. */
  readonly writes: number;
}

/** Inputs used to create one retained document composition runtime. */
export interface CreateHtmlDocumentCompositionRuntimeOptions {
  /** Retained document whose canonical ownership hosts the preedit. */
  readonly documentView: HtmlRetainedDocumentView;
  /** Canonical measurement owner used to resolve composition attachment points. */
  readonly resolveDomPoint: (pos: number, side?: number) => HtmlDomPoint;
  /** Browser document used for transient DOM and Range geometry. */
  readonly ownerDocument: Document;
  /** Stable mounted HTML root identity used by measured provenance. */
  readonly rootId: string;
  /** Stable continuous-flow region identity used by measured provenance. */
  readonly regionId: string;
  /** Optional internal diagnostic sink for explicit composition gaps. */
  readonly onGap?: ((message: string) => void) | undefined;
}

/** Session runtime for one in-flow retained HTML preedit. */
export interface HtmlDocumentCompositionRuntime {
  /** Current transient descriptor, or undefined outside composition. */
  readonly descriptor: HtmlCompositionDesc | undefined;
  /**
   * Synchronizes visible preedit state into retained browser flow.
   *
   * @param preedit - Current preedit, or undefined to cancel it.
   * @param presentation - Semantic IME presentation resolved by the surface.
   * @returns Active state and direct transient write count.
   */
  sync(
    preedit: QuireImePreedit | undefined,
    presentation: HtmlCompositionPresentation
  ): HtmlCompositionSyncResult;
  /**
   * Restores canonical DOM before reconciliation and maps an active session.
   *
   * @param mapping - Canonical mapping applied by the pending document update.
   * @param preserve - Whether active preedit state should survive the update.
   * @returns Mapped preedit, or undefined when cancelled or stale.
   */
  prepareDocumentUpdate(
    mapping: Mapping,
    preserve: boolean
  ): QuireImePreedit | undefined;
  /**
   * Measures the collapsed browser Range after current preedit text.
   *
   * @returns Candidate-window anchor with complete provenance, when active.
   */
  inputAnchor(): HtmlMeasuredClientRect | undefined;
  /**
   * Carries a canonical DOM point to where its character currently sits around the preedit.
   *
   * @param point - DOM point resolved from retained ownership.
   * @returns Point valid in the DOM holding the preedit.
   */
  projectDomPoint<T extends HtmlDomPoint>(point: T): T;
  /**
   * Reads current composition-gap diagnostics.
   *
   * @returns Immutable diagnostic snapshot.
   */
  getDiagnostics(): HtmlDocumentCompositionDiagnostics;
  /** Restores canonical DOM and releases the transient descriptor. */
  destroy(): void;
}

/** Persistent internal retained document facade. */
export interface HtmlRetainedDocumentView {
  /** Immortal retained document root. */
  readonly root: HtmlDocumentDesc;
  /**
   * Applies one mapped canonical document update.
   *
   * @param options - Next document, mapping, and typed changed ranges.
   * @returns Reconciliation result with exact DOM writes.
   */
  update(options: HtmlDocumentUpdateOptions): HtmlReconcileResult;
  /**
   * Resolves a canonical document position through descriptor ownership.
   *
   * @param pos - Canonical document position.
   * @param side - Preferred side at a descriptor boundary.
   * @returns Descriptor-owned DOM point.
   */
  domAtPos(pos: number, side?: number): HtmlDomPoint;
  /**
   * Resolves an owned DOM point back to a canonical document position.
   *
   * @param node - DOM node owned by the retained tree.
   * @param offset - DOM offset within the node.
   * @param bias - Preferred side at a child boundary.
   * @returns Canonical document position.
   */
  posAtDOM(node: Node, offset: number, bias?: number): number;
  /**
   * Returns the retained outer DOM node beginning at a document position.
   *
   * @param pos - Canonical position before a schema node.
   * @returns Retained node DOM, or null when no node begins there.
   */
  nodeDOM(pos: number): Node | null;
  /**
   * Resolves the nearest retained descriptor that owns a DOM node.
   *
   * @param node - DOM node whose retained owner is requested.
   * @returns Current retained owner, or undefined outside this document.
   */
  ownerAtDOM(node: Node): HtmlDescriptor | undefined;
  /**
   * Resolves one current descriptor by its document-local identity.
   *
   * @param descriptorId - Exact retained descriptor identity.
   * @returns Current retained descriptor, or undefined after replacement.
   */
  descriptorById(descriptorId: string): HtmlDescriptor | undefined;
  /**
   * Lists represented descriptors overlapping one canonical range.
   *
   * @param range - Canonical range to query.
   * @returns Ordered retained descriptors intersecting the range.
   */
  descriptorsInRange(
    range: { readonly from: number; readonly to: number }
  ): readonly HtmlDescriptor[];
  /**
   * Routes a DOM event through the nearest enclosing custom NodeView.
   *
   * @param event - DOM event whose target belongs to retained content.
   * @returns Whether custom ownership stopped editor handling.
   */
  stopEvent(event: Event): boolean;
  /** Releases the retained tree exactly once. */
  destroy(): void;
}

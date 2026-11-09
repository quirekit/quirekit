import type {
  QuireChangedRange,
  QuireMarkViewConstructor,
  QuireNodeViewConstructor
} from "@quirekit/core";
import type {
  Decoration,
  DecorationSource,
  Mark,
  Mapping,
  Node as ProseMirrorNode
} from "@quirekit/pm";
import type { QuireDocumentRange } from "@quirekit/renderer";
import type {
  QuireLayoutSourceRef
} from "@quirekit/layout/identity";
import type {
  HtmlContainerDesc,
  HtmlDescriptor,
  HtmlDescriptorDiagnostic,
  HtmlDescriptorMount,
  HtmlDescriptorSourceResolver,
  HtmlDocumentDesc
} from "../descriptors";
import type { HtmlNodeViewEnvironment } from "../node-view/types";

/** One direct text-node mutation performed by reconciliation. */
export interface HtmlTextWrite {
  /** Retained descriptor whose text node changed. */
  readonly descriptorId: string;
  /** Text value written to the DOM node. */
  readonly value: string;
}

/** One direct element-attribute mutation performed by reconciliation. */
export interface HtmlAttributeWrite {
  /** Retained descriptor whose element changed. */
  readonly descriptorId: string;
  /** Attribute name patched on the retained element. */
  readonly name: string;
  /** Next value, or null when the attribute was removed. */
  readonly value: string | null;
}

/** One direct child-list mutation performed by reconciliation. */
export interface HtmlStructureWrite {
  /** Child-list operation applied by the patch host. */
  readonly operation: "insert" | "move" | "remove";
  /** Retained child descriptor affected by the operation. */
  readonly descriptorId: string;
  /** Retained parent descriptor whose child list changed. */
  readonly parentId: string;
  /** Target or former child index. */
  readonly index: number;
}

/** Exact DOM writes emitted by one retained reconciliation pass. */
export interface HtmlReconcileTrace {
  /** Retained descriptor targets visited during bounded reconciliation. */
  readonly descriptorVisits: number;
  /** Custom NodeView update calls attempted during reconciliation. */
  readonly nodeViewUpdateAttempts: number;
  /** Decoration-owned attribute writes performed at their call sites. */
  readonly decorationWrites: number;
  /** Descriptor ids whose text node values changed. */
  readonly textWrites: readonly string[];
  /** Detailed text writes for diagnostics. */
  readonly textWriteDetails: readonly HtmlTextWrite[];
  /** Direct attribute writes in execution order. */
  readonly attributeWrites: readonly HtmlAttributeWrite[];
  /** Direct insert, move, and remove writes in execution order. */
  readonly structureWrites: readonly HtmlStructureWrite[];
  /** Observed document-root mount identity changes during reconciliation. */
  readonly rootReplacements: number;
}

/** Mutable trace surface owned only by the narrow DOM patch host. */
export interface MutableHtmlReconcileTrace {
  /** Mutable descriptor visit count. */
  descriptorVisits: number;
  /** Mutable NodeView update attempt count. */
  nodeViewUpdateAttempts: number;
  /** Mutable decoration write count. */
  decorationWrites: number;
  /** Mutable descriptor ids whose text changed. */
  readonly textWrites: string[];
  /** Mutable detailed text write records. */
  readonly textWriteDetails: HtmlTextWrite[];
  /** Mutable attribute write records. */
  readonly attributeWrites: HtmlAttributeWrite[];
  /** Mutable child-list write records. */
  readonly structureWrites: HtmlStructureWrite[];
  /** Mutable root replacement count. */
  rootReplacements: number;
}

/** Inputs for one transaction-mapped retained-tree reconciliation. */
export interface ReconcileHtmlDescriptorTreeOptions {
  /** Existing immortal document root. */
  readonly root: HtmlDocumentDesc;
  /** Next canonical ProseMirror document. */
  readonly documentNode: ProseMirrorNode;
  /** Mapping from the root's previous document to the next document. */
  readonly mapping: Mapping;
  /** Typed old/new ranges changed by the transaction batch. */
  readonly changedRanges: readonly QuireChangedRange[];
  /** Browser document used to create newly required shells. */
  readonly ownerDocument: Document;
  /** Monotonic allocator for every newly created descendant. */
  readonly allocateId: () => string;
  /** Optional resolver for genuinely distinct node-supplied source identities. */
  readonly resolveSource?: HtmlDescriptorSourceResolver | undefined;
  /** Optional exact node and mark factory environment. */
  readonly nodeViewEnvironment?: HtmlNodeViewEnvironment | undefined;
  /** Whether the live decoration source changed since the previous pass. */
  readonly decorationsChanged?: boolean | undefined;
}

/** Result of one retained HTML reconciliation pass. */
export interface HtmlReconcileResult {
  /** Same immortal document descriptor supplied to reconciliation. */
  readonly root: HtmlDocumentDesc;
  /** Whether descriptor identity, order or custom-view DOM ownership may have changed. */
  readonly ownershipChanged: boolean;
  /** Smallest parent-bounded containers reconciled by this pass. */
  readonly dirtyContainers: readonly string[];
  /** Schema-to-DOM gaps found while creating required descendants. */
  readonly diagnostics: readonly HtmlDescriptorDiagnostic[];
  /** Exact text, attribute, structure, and root writes. */
  readonly trace: HtmlReconcileTrace;
}

/** Desired direct child shape used by parent-bounded matching. */
export interface HtmlTargetDescriptor {
  /** Descriptor kind required by the next document. */
  readonly kind: "node" | "node-view" | "mark" | "text" | "widget" | "inline-decoration";
  /** Presentation attributes outside the canonical text/mark chain. */
  readonly inlineAttrs?: import("@quirekit/pm").DecorationAttrs | undefined;
  /** ProseMirror node represented by the target. */
  readonly node: ProseMirrorNode;
  /** Mark represented by a mark target. */
  readonly mark?: Mark | undefined;
  /** Index of the represented mark in the text node's mark set. */
  readonly markIndex?: number | undefined;
  /** Exact next-document range represented by the target. */
  readonly range: QuireDocumentRange;
  /** Explicit source identity inherited from the owning retained product. */
  readonly source: QuireLayoutSourceRef;
  /** Candidate schema shell rendered before any retained DOM reuse decision. */
  readonly candidateMount?: HtmlDescriptorMount | null | undefined;
  /** Exact custom node factory for a NodeView target. */
  readonly nodeViewFactory?: QuireNodeViewConstructor | undefined;
  /** Exact custom mark factory for a mark-view target. */
  readonly markViewFactory?: QuireMarkViewConstructor | undefined;
  /** Keyed widget decoration for a retained widget target. */
  readonly widgetDecoration?: Decoration | undefined;
  /** Stable keyed widget identity. */
  readonly widgetKey?: string | undefined;
  /** Widget position mapping association. */
  readonly widgetSide?: number | undefined;
  /** Parent-local outer decorations offered to a NodeView. */
  readonly outerDecorations?: readonly Decoration[] | undefined;
  /** Child-local decoration source offered to a NodeView. */
  readonly innerDecorations?: DecorationSource | undefined;
}

/** Range-mapping output consumed by parent-bounded reconciliation. */
export interface HtmlMappedDescriptorResult {
  /** Smallest dirty containers selected after mapping. */
  readonly dirtyContainers: readonly HtmlContainerDesc[];
  /** Descriptors whose mapped ownership was deleted. */
  readonly invalidDescriptors: ReadonlySet<HtmlDescriptor>;
}

/** Ordered matches and removals selected within one dirty parent. */
export interface HtmlChildMatchResult {
  /** Existing descriptor selected for each target, or null for creation. */
  readonly matches: readonly (HtmlDescriptor | null)[];
  /** Existing children that no longer represent a target. */
  readonly removals: readonly HtmlDescriptor[];
  /** Stable ownership diagnostics found while reserving source identity. */
  readonly diagnostics: readonly HtmlDescriptorDiagnostic[];
}

/** Narrow direct-DOM mutation host used only by retained reconciliation. */
export interface HtmlDomPatchHost {
  /**
   * Patches one retained text node when its value changed.
   *
   * @param descriptor - Direct text owner.
   * @param value - Next canonical text.
   */
  patchText(descriptor: HtmlDescriptor, value: string): void;
  /**
   * Patches element attributes from a topology-compatible candidate shell.
   *
   * @param descriptor - Retained descriptor that owns the current shell.
   * @param desired - Candidate shell carrying desired attributes.
   */
  patchAttributes(descriptor: HtmlDescriptor, desired: Element): void;
  /**
   * Inserts or moves one retained child to its exact parent index.
   *
   * @param parent - Retained parent descriptor.
   * @param child - Retained child descriptor.
   * @param index - Desired DOM child index.
   */
  placeChild(parent: HtmlContainerDesc, child: HtmlDescriptor, index: number): void;
  /**
   * Removes one obsolete retained child from its current parent.
   *
   * @param parent - Retained parent descriptor.
   * @param child - Obsolete retained child.
   */
  removeChild(parent: HtmlContainerDesc, child: HtmlDescriptor): void;
}

import type { Command, QuireEditor, QuireJSONContent } from "@quirekit/core";
import type { Node as PMNode } from "@quirekit/pm";

/** Stable identity of a block inside one loaded document. */
export interface BlockRef {
  /** Document load epoch. */
  readonly rootId: string;
  /** Direct parent identity. */
  readonly scopeId: string;
  /** Persistent, opaque schema identity. */
  readonly blockId: string;
}

/** Continuous structural selection bound to a document revision. */
export interface BlockRangeRef {
  /** First selected endpoint. */
  readonly anchor: BlockRef;
  /** Last selected endpoint, possibly preceding the anchor. */
  readonly focus: BlockRef;
  /** Revision whose membership the caller observed. */
  readonly expectedDocumentRevision: number;
}

/** Insertion boundary adjacent to an identified block. */
export interface BlockSlotRef {
  /** Block that owns the boundary. */
  readonly target: BlockRef;
  /** Structural boundary side. */
  readonly side: "before" | "after";
  /** Revision whose boundary the caller observed. */
  readonly expectedDocumentRevision: number;
}

/** Read-only source facts resolved from a schema block. */
export interface BlockFact extends BlockRef {
  /** Position immediately before the complete block. */
  readonly from: number;
  /** Position immediately after the complete block. */
  readonly to: number;
  /** Position at the start of the parent's content. */
  readonly scopeFrom: number;
  /** Direct sibling order. */
  readonly order: number;
  /** Complete immutable source node. */
  readonly node: PMNode;
}

/** Current document-scoped identity catalog. */
export interface BlockCatalog {
  /** Loaded document epoch. */
  readonly rootId: string;
  /** Content revision; selection updates do not increment it. */
  readonly revision: number;
  /** Document described by these facts. */
  readonly doc: PMNode;
  /** Supported direct children in document order. */
  readonly blocks: readonly BlockFact[];
  /** Unique identity lookup; conflicts are omitted. */
  readonly byId: ReadonlyMap<string, BlockFact>;
  /** Complete source-boundary lookup, collected on first use after a document change. */
  readonly byFrom: ReadonlyMap<number, BlockFact>;
}

/** Stable rejection categories for block actions. */
export type BlockRejection = "stale" | "cross-scope" | "self" | "read-only" | "protected" | "locked" | "schema" | "anchor" | "revision" | "unsupported";

/** Complete candidate supplied to the feature-specific admission owner. */
export interface BlockAdmissionContext {
  /** Current editor for live authorization policy. */
  readonly editor: QuireEditor;
  /** Current candidate document, including earlier chain steps. */
  readonly doc: PMNode;
  /** Complete source blocks; empty for insertion. */
  readonly source: readonly BlockFact[];
  /** Destination block. */
  readonly target: BlockFact;
  /** Exact destination position in the pre-move document. */
  readonly position: number;
}

/** Configuration for opt-in structural block behavior. */
export interface BlockInteractionOptions {
  /** Block types whose complete subtrees can be moved. */
  readonly types: readonly string[];
  /** Allowed direct parents; nested unlisted parents remain unavailable. */
  readonly scopes: readonly string[];
  /** Allocates an opaque identity for a newly created block. */
  readonly createId: () => string;
  /** Live feature policy; null permits the candidate. */
  readonly admit: (context: BlockAdmissionContext) => BlockRejection | null;
  /** Declares durable external references requiring a portable export projection. */
  readonly requirePortableIdentity: boolean;
}

/** Typed request to move a continuous sibling range. */
export interface BlockMoveRequest {
  /** Immutable source membership reference. */
  readonly source: BlockRangeRef;
  /** Immutable destination boundary reference. */
  readonly destination: BlockSlotRef;
}

/** Typed request to insert at a captured structural boundary. */
export interface BlockInsertRequest {
  /** Captured destination boundary. */
  readonly destination: BlockSlotRef;
  /** New schema content; identities are allocated by normalization. */
  readonly content?: QuireJSONContent | undefined;
  /** Replaces an empty ordinary target paragraph instead of adding a sibling. */
  readonly replaceEmpty?: boolean;
  /** Synchronous semantic command run at the new block before the single commit. */
  readonly initialize?: Command;
}

/** Commands installed by the structural block feature. */
export interface BlockCommandMethods<ReturnType> {
  /** Selects complete sibling blocks; null collapses the current selection to a legal cursor. */
  readonly selectBlockRange: (range: BlockRangeRef | null) => ReturnType;
  /** Moves a complete range in one history event. */
  readonly moveBlockRange: (request: BlockMoveRequest) => ReturnType;
  /** Inserts new content at a captured slot. */
  readonly insertBlockAt: (request: BlockInsertRequest) => ReturnType;
}

declare module "@quirekit/core" {
  interface Commands<ReturnType> {
    /** Structural block operations. */
    readonly blockInteraction: BlockCommandMethods<ReturnType>;
  }
}

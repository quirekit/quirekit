import type { QuireRect } from "@quirekit/renderer";
import type { QuireLayoutNode, QuireRetainedLayoutSnapshot } from "@quirekit/view-engine";
import type { HtmlNodeDesc } from "../../descriptors";
import type { HtmlReconcileTrace } from "../../reconcile";

/** Inputs to a verified, topology-preserving native block-flow update. */
export interface HtmlFlowRectUpdate {
  /** Immutable previous surface-local block rectangles. */
  readonly previous: readonly QuireRect[];
  /** Indexes of blocks containing actual text writes. */
  readonly changed: readonly number[];
  /** Previous measured natural surface height. */
  readonly previousHeight: number;
  /** Current measured natural surface height. */
  readonly height: number;
  /** Reads one current block in the same surface-local coordinate space. */
  readonly read: (index: number) => QuireRect;
}

/** Exact write evidence admitted by the geometry lifecycle. */
export interface HtmlFlowGeometryUpdate {
  /** Scheduler reason; non-transaction updates conservatively remeasure. */
  readonly reason: string;
  /** Actual retained reconciliation writes, when available. */
  readonly trace: HtmlReconcileTrace | undefined;
  /** Whether transient IME DOM was modified. */
  readonly compositionWrites: number;
}

/** Cached admission and complete immutable products for one native block flow. */
export interface HtmlFlowGeometryCache {
  /** Previously published complete geometry. */
  readonly snapshot: QuireRetainedLayoutSnapshot;
  /** Stable native top-level descriptors, in document order. */
  readonly blocks: readonly HtmlNodeDesc[];
  /** Stable descriptor identity to top-level index. */
  readonly indexes: ReadonlyMap<string, number>;
  /** Last complete surface-local rectangles. */
  readonly rects: readonly QuireRect[];
  /** Document origin relative to the content surface. */
  readonly origin: { readonly x: number; readonly y: number };
}

/** Per-presentation geometry evidence, separate from source-position work. */
export interface HtmlFlowGeometryDiagnostics {
  /** Whether native blocks were remeasured completely or incrementally. */
  readonly mode: "full" | "incremental" | "reuse";
  /** Native block rectangles read in this presentation. */
  readonly blockReads: number;
  /** Block rectangles shared with the previous snapshot during incremental content rebinding. */
  readonly reusedRects: number;
  /** Complete flow-query index constructions performed. */
  readonly indexBuilds: number;
  /** Existing flow-query index bindings updated. */
  readonly indexRefits: number;
}

/** Snapshot and stable-topology updates consumed by the hit geometry owner. */
export interface HtmlFlowGeometryProduct {
  /** Complete current, immutable source-bound geometry. */
  readonly snapshot: QuireRetainedLayoutSnapshot;
  /** Changed block products; present only when hit-tree topology is preserved. */
  readonly changedBlocks?: ReadonlyMap<string, QuireLayoutNode> | undefined;
}

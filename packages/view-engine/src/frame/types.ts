import type { QuireLayoutMeasuredPhase, QuireLayoutTraceSink } from "@quirekit/layout/inline";
import type { QuireLayoutProductCounters } from "../editor-layout/snapshot/reuse/types";
import type { QuireEditor, QuireEditorState } from "@quirekit/core";
import type { Mapping, Node, Step } from "@quirekit/pm";
import type {
  QuirePaginationCheckpointStoreCounters,
  QuireRetainedPaginationCheckpointStore
} from "@quirekit/layout/pagination";
import type {
  QuireDisplayList,
  QuireRect,
  QuireViewTarget
} from "@quirekit/renderer";
import type {
  QuireDecorationCollectionScope,
  QuireDecorationLanes,
  QuireDecorationSourceView,
  QuireDecorationThemeRegistry
} from "../decorations";
import type {
  QuireDisplayCommandCache,
  QuireDisplayCommandCacheSnapshot,
  QuireDisplayListStyles,
  QuireSurfaceConfig
} from "../display-list";
import type {
  QuireDisplayInvalidationProjection,
  QuirePageStackDisplayListChunkIndex,
  QuireRetainedDisplayOwnerChunkIndex,
  QuireRetainedDisplayOwnerDiagnostics,
  QuireRetainedDisplayOwnerIndex,
  QuireViewDisplayChunkCounters
} from "../display-ownership";
import type {
  QuireRetainedLayoutSnapshot,
  QuireLayoutSnapshotOptions
} from "../editor-layout";
import type {
  QuireLayoutDirtyRange,
  QuireViewUpdatePatch
} from "../invalidation";
import type {
  QuireSelectionGeometry,
  QuireSelectionGeometryContext
} from "../interaction";
import type {
  CanvasBlockShapeCache,
  CanvasBlockShapeCacheCounters,
  CanvasMeasuredSourceCache,
  CanvasMeasuredSourceCacheCounters,
  QuireImePreedit,
  QuireLayoutDomOverlay,
  QuireRetainedBlockLayoutGraph,
  QuireRetainedBlockLayoutGraphCounters
} from "../layout";

/** One exact source-node replacement used only by a speculative frame build. */
export interface QuireTransientNodeLayoutPatch {
  /** Exact position immediately before the source node. */
  readonly position: number;
  /** Optional pre-transaction position receiving the source node relocation. */
  readonly targetPosition?: number | undefined;
  /** Expected schema node name guarding against stale source positions. */
  readonly nodeTypeName: string;
  /** Complete node attributes visible to the speculative layout pass. */
  readonly attrs: Readonly<Record<string, unknown>>;
}

/** Visual role of one presentation overlay range. */
export type QuirePresentationOverlayRole = "inserted" | "removed" | "changed";

/** One presentation-document range painted with a role style. */
export interface QuirePresentationOverlayRange {
  /** Start position in the presentation document. */
  readonly from: number;
  /** End position in the presentation document. */
  readonly to: number;
  /** Role selecting the paint style. */
  readonly role: QuirePresentationOverlayRole;
}

/** Paint style applied to one overlay role. */
export interface QuirePresentationOverlayRoleStyle {
  /** Background fill behind the range's text. */
  readonly background?: string | undefined;
  /** Replacement text color. */
  readonly textColor?: string | undefined;
  /** Line painted with the text. */
  readonly line?: "underline" | "strikethrough" | undefined;
  /** Line color; defaults to the text color. */
  readonly lineColor?: string | undefined;
}

/**
 * Render-only speculative content shown on top of the canonical document.
 *
 * Frames apply `steps` to `baseDoc` without dispatching, so history,
 * collaboration and plugin state never observe the overlay.
 */
export interface QuirePresentationOverlay {
  /** Canonical document the steps were planned against; frames on other documents ignore the overlay. */
  readonly baseDoc: Node;
  /** Steps producing the presentation document from `baseDoc`. */
  readonly steps: readonly Step[];
  /** Role ranges in presentation-document positions. */
  readonly ranges: readonly QuirePresentationOverlayRange[];
  /** Optional per-role style overrides of the engine defaults. */
  readonly styles?: Partial<Record<QuirePresentationOverlayRole, QuirePresentationOverlayRoleStyle>> | undefined;
}

/** Measured phase emitted while the engine compiles one frame. */
export type QuireViewEngineMeasuredPhase = QuireLayoutMeasuredPhase;

/**
 * Receives one measured View Engine phase.
 *
 * @param phase - Phase timing emitted by frame compilation.
 */
export type QuireViewEngineTraceSink = QuireLayoutTraceSink;

/** Inputs for reusing a mounted snapshot against exact current frame options. */
export interface CanReuseQuireViewEngineLayoutSnapshotOptions {
  /** Last committed geometry whose canonical owner carries the proof. */
  readonly snapshot: QuireRetainedLayoutSnapshot;
  /** Exact current editor state. */
  readonly state: QuireEditorState;
  /** Complete current frame configuration, including typed update evidence. */
  readonly options: QuireViewEngineFrameBuildOptions;
  /** Whether selection-sensitive geometry must also remain unchanged. */
  readonly requireSelectionIndependentGeometry?: boolean | undefined;
}

/** Renderer-neutral inputs used to compile one editor frame. */
export interface QuireViewEngineFrameBuildOptions extends Omit<QuireLayoutSnapshotOptions,
  "state" | "editor" | "font" | "textBaselineOffset" | "lineBreakMode"
  | "blockShapeCache" | "measuredSourceCache" | "paginationCheckpointStore"
  | "snapshotClipRects" | "trace" | "transientPreview"
> {
  /** View-local auxiliary story source currently owning explicit editing. */
  readonly activeAuxiliaryStorySourceId?: string | undefined;
  /** Optional transient IME preedit measured without committing. */
  readonly imePreedit?: QuireImePreedit | undefined;
  /** Optional exact node replacement measured without dispatching. */
  readonly transientNodeLayoutPatch?: QuireTransientNodeLayoutPatch | undefined;
  /** Optional render-only overlay applied after the node patch and before IME preedit. */
  readonly presentationOverlay?: QuirePresentationOverlay | undefined;
  /** Optional style overrides for generated commands. */
  readonly displayListStyles?: Partial<QuireDisplayListStyles> | undefined;
  /** Optional semantic styling for selection and IME affordances. */
  readonly surfaceConfig?: QuireSurfaceConfig | undefined;
  /** Document-space rectangles limiting the adapted layout tree. */
  readonly layoutSnapshotClipRects?: readonly QuireRect[] | undefined;
  /** Document-space rectangles limiting display command generation. */
  readonly displayListClipRects?: readonly QuireRect[] | undefined;
  /** Optional source used to resolve direct and plugin decoration props. */
  readonly decorationSourceView?: QuireDecorationSourceView | undefined;
  /** Decoration subset admitted by this frame. */
  readonly decorationScope?: QuireDecorationCollectionScope | undefined;
  /** Optional class-token registry used to resolve decoration classes. */
  readonly decorationTheme?: QuireDecorationThemeRegistry | undefined;
  /** Optional width used when generating collapsed selection carets. */
  readonly caretWidth?: number | undefined;
  /** Retained context used to disambiguate repeated visual instances. */
  readonly selectionContext?: QuireSelectionGeometryContext | undefined;
  /** Omits caret commands while preserving caret geometry. */
  readonly omitCaretCommands?: boolean | undefined;
  /** Optional sink receiving measured engine phases. */
  readonly trace?: QuireViewEngineTraceSink | undefined;
  /** Whether the frame must contain page-local display chunks. */
  readonly requirePageDisplayListChunks?: boolean | undefined;
}

/** Cache authority owned by one accepted or speculative Engine runtime lane. */
export interface QuireViewEngineFrameCacheAuthority {
  /** Per-block text shaping cache. */
  readonly blockShapeCache: CanvasBlockShapeCache;
  /** Canonical retained top-level block graph. */
  readonly retainedBlockGraph: QuireRetainedBlockLayoutGraph;
  /** Per-layout-box measured pagination cache. */
  readonly measuredSourceCache: CanvasMeasuredSourceCache;
  /** Per-runtime pagination checkpoint store. */
  readonly paginationCheckpointStore: QuireRetainedPaginationCheckpointStore;
  /** Per-text-fragment display command cache. */
  readonly displayCommandCache: QuireDisplayCommandCache;
}


/** Cache counters sampled after one Engine frame build. */
export interface QuireViewEngineFrameCacheCounters {
  /** Actual canonical layout work and last admission decision. */
  readonly layoutProduct: QuireLayoutProductCounters;
  /** Retained top-level block graph counters. */
  readonly retainedBlock: QuireRetainedBlockLayoutGraphCounters;
  /** Per-section retained graph counters of multi-section documents, in section order. */
  readonly sectionRetainedBlocks?: readonly QuireRetainedBlockLayoutGraphCounters[] | undefined;
  /** Per-block text shaping cache counters. */
  readonly blockShape: CanvasBlockShapeCacheCounters;
  /** Pagination measured-source cache counters. */
  readonly measuredSource: CanvasMeasuredSourceCacheCounters;
  /** Retained pagination checkpoint-store counters. */
  readonly paginationCheckpoint: QuirePaginationCheckpointStoreCounters;
  /** Text display-command cache counters. */
  readonly displayCommand: QuireDisplayCommandCacheSnapshot;
}

/** Renderer-neutral artifacts produced by one View Engine frame build. */
export interface QuireViewEngineFrame {
  /** Layout snapshot built from one exact editor state. */
  readonly layoutSnapshot: QuireRetainedLayoutSnapshot;
  /** Snapshot extended with render-time retained interaction targets. */
  readonly interactionSnapshot: QuireRetainedLayoutSnapshot;
  /**
   * Maps canonical document positions to frame document positions when a
   * presentation overlay or IME preedit changed the frame document; absent
   * when both documents share positions.
   */
  readonly canonicalPositionMapping?: Mapping | undefined;
  /** Retained selection context used for repeated visual instances. */
  readonly selectionContext?: QuireSelectionGeometryContext | undefined;
  /** Layout dirty range that triggered this frame. */
  readonly layoutDirtyRange?: QuireLayoutDirtyRange | null | undefined;
  /** Typed update patch that triggered this frame. */
  readonly updatePatch?: QuireViewUpdatePatch | null | undefined;
  /** Explicit retained display owners compiled from the layout snapshot. */
  readonly displayOwnerIndex: QuireRetainedDisplayOwnerIndex;
  /** Typed invalidation projected onto retained display owners. */
  readonly displayInvalidation: QuireDisplayInvalidationProjection;
  /** Owner compilation and realization diagnostics. */
  readonly displayOwnerDiagnostics: QuireRetainedDisplayOwnerDiagnostics;
  /** Commands emitted directly into retained owner chunks. */
  readonly displayOwnerChunks: QuireRetainedDisplayOwnerChunkIndex;
  /** Cache counters sampled after frame compilation. */
  readonly cacheCounters?: QuireViewEngineFrameCacheCounters | undefined;
  /** Selection geometry built from the layout snapshot. */
  readonly selectionGeometry: QuireSelectionGeometry;
  /** Renderer-neutral decoration lanes built from editor props. */
  readonly decorationLane: QuireDecorationLanes;
  /** Composite display list used by non-chunked surfaces. */
  readonly displayList: QuireDisplayList;
  /** Persistent composite content list for non-chunked surfaces. */
  readonly contentDisplayList: QuireDisplayList;
  /** Transient composite overlay list for non-chunked surfaces. */
  readonly overlayDisplayList: QuireDisplayList;
  /** Optional page-local display chunks for paginated consumers. */
  readonly pageDisplayListChunks?: QuirePageStackDisplayListChunkIndex | undefined;
  /** Display chunk production counters. */
  readonly displayChunkCounters?: QuireViewDisplayChunkCounters | undefined;
  /** DOM overlay descriptors consumed by mounted synchronization. */
  readonly domOverlays: readonly QuireLayoutDomOverlay[];
  /** qkView interaction targets consumed by mounted event dispatch. */
  readonly viewTargets: readonly QuireViewTarget[];
}

/** Opaque editor-scoped authority for accepted and transient Engine frames. */
export interface QuireViewEngineRuntime {
  /**
   * Builds one accepted frame using retained accepted-state caches.
   *
   * @param options - Renderer-neutral frame inputs.
   * @returns Compiled frame artifacts.
   */
  buildFrame(options: QuireViewEngineFrameBuildOptions): QuireViewEngineFrame;
  /**
   * Builds one speculative frame using isolated transient caches.
   *
   * @param options - Frame inputs carrying transient source state.
   * @returns Compiled speculative frame artifacts.
   */
  buildTransientFrame(options: QuireViewEngineFrameBuildOptions): QuireViewEngineFrame;
}

/** Options used to create an editor-scoped View Engine runtime. */
export interface CreateQuireViewEngineRuntimeOptions {
  /** Editor whose immutable state supplies frame source authority. */
  readonly editor: QuireEditor;
}

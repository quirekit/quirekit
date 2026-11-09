import type { QuireViewUpdatePatch, QuireLayoutDirtyRange } from "@quirekit/view-engine";
import type {
  QuireImePreedit,
  QuireSelectionGeometryContext
} from "@quirekit/view-engine";
import type { DecorationSource } from "@quirekit/pm";
import type { HtmlMeasuredClientRect, HtmlMeasuredDomPoint } from "../measurement";
import type { HtmlMountedRenderSurfaceState } from "../surface";
import type {
  HtmlMountedView,
  HtmlMountedViewElements,
  HtmlMountedViewOptions,
  HtmlMountedViewRuntimeOptions
} from "../types";
import type {
  QuireMountedEditorViewUpdateOptions,
  QuireMountedViewUpdateReason
} from "@quirekit/view/mounted-backend";
import type { HtmlFlowRenderResult } from "../geometry/types";

/** Reason accepted by the continuous-flow HTML presentation. */
export type HtmlContinuousFlowRenderReason =
  | QuireMountedViewUpdateReason
  | "initial"
  | "manual";

/** Editor update facts submitted to the continuous-flow presentation. */
export interface HtmlContinuousFlowRenderOptions {
  /** Editor whose current state is authoritative. */
  readonly editor: QuireMountedEditorViewUpdateOptions["editor"];
  /** Semantic reason for the render. */
  readonly reason: HtmlContinuousFlowRenderReason;
  /** True only for element ResizeObserver notifications, never viewport or manual resize requests. */
  readonly passiveResize?: boolean | undefined;
  /** Active IME preedit, when composition owns transient text. */
  readonly imePreedit?: QuireImePreedit | undefined;
  /** Applied transactions represented by this update. */
  readonly transactions?: QuireMountedEditorViewUpdateOptions["transactions"];
}

/** Browser DOM geometry measured between content and overlay writes. */
export interface HtmlContinuousFlowDomGeometry {
  /** Content surface origin in viewport CSS coordinates. */
  readonly surfaceClientRect: Pick<DOMRect, "left" | "top">;
  /** Collapsed input and candidate anchor. */
  readonly inputAnchor: HtmlMeasuredClientRect;
  /** Collapsed caret rectangle, omitted for a range selection. */
  readonly caret?: HtmlMeasuredClientRect | undefined;
  /** Browser Range rectangles for the current selection. */
  readonly selectionRects: readonly HtmlMeasuredClientRect[];
  /** Retained DOM endpoints mirrored while document input owns focus. */
  readonly mirror: {
    /** Model anchor projected into retained DOM. */
    readonly anchor: HtmlMeasuredDomPoint;
    /** Model head projected into retained DOM. */
    readonly head: HtmlMeasuredDomPoint;
  };
  /** Detached DOM Range reads performed by the batch. */
  readonly rangeReads: number;
}

/** Current renderer-neutral and browser-surface products. */
export interface HtmlContinuousFlowRenderState {
  /** Renderer-neutral layout, display, and interaction products. */
  readonly renderResult: HtmlFlowRenderResult;
  /** Measured continuous-flow surface geometry. */
  readonly surfaceState: HtmlMountedRenderSurfaceState;
}

/** Construction options for one mounted continuous-flow presentation. */
export interface CreateHtmlContinuousFlowPresentationOptions {
  /** Stable mounted view identity. */
  readonly id: string;
  /** Mounted editor-facing facade used by NodeView and render callbacks. */
  readonly mountedView: HtmlMountedView;
  /** Editor that owns document state and extension providers. */
  readonly editor: HtmlMountedViewOptions["editor"];
  /** DOM surfaces owned by the mounted HTML backend. */
  readonly elements: HtmlMountedViewElements;
  /** Optional HTML backend sizing and presentation configuration. */
  readonly runtime?: HtmlMountedViewRuntimeOptions | undefined;
  /** Reads the current interaction geometry context. */
  readonly getSelectionGeometryContext: () => QuireSelectionGeometryContext | undefined;
  /** Restores focus to the canonical document input proxy. */
  readonly focusDocumentInput: () => void;
  /** Reports whether the mounted editor currently owns document focus. */
  readonly hasFocus: () => boolean;
  /** Reports whether the mounted facade has already been destroyed. */
  readonly isDestroyed: () => boolean;
  /** Commits document-focus state to the mounted facade. */
  readonly setDocumentFocused: (focused: boolean) => void;
  /** Replaces interaction targets after one committed render. */
  readonly setViewTargets: (targets: HtmlFlowRenderResult["viewTargets"]) => void;
  /** Records post-update work when a focused mutation requests a frame. */
  readonly requestDeferredPostUpdate: () => void;
  /** Completes pending editor work after the current render commits. */
  readonly completeDeferredPostUpdate: () => void;
  /** Resolves PM decoration providers in mounted view order. */
  readonly resolveDecorationSource: () => DecorationSource;
}

/** Presentation-owned payload carried by one scheduled HTML update. */
export interface HtmlPresentationScheduledPayload {
  /** Latest editor update inputs represented by the request. */
  readonly options: HtmlContinuousFlowRenderOptions;
  /** Whether retained content products can replace a shared full render build. */
  readonly reuseContentRender: boolean;
}

/** Products created before the final overlay-write phase. */
export interface HtmlPresentationRenderProducts {
  /** Measured surface state for this render. */
  readonly surfaceState: HtmlMountedRenderSurfaceState;
  /** Renderer-neutral geometry and overlay products. */
  readonly renderResult: HtmlFlowRenderResult;
  /** Strategy reported to diagnostics. */
  readonly strategy: "full" | "selection-update";
  /** Semantic render reason. */
  readonly reason: HtmlContinuousFlowRenderOptions["reason"];
  /** Browser DOM geometry measured before transient presentation writes. */
  readonly domGeometry: HtmlContinuousFlowDomGeometry;
}

/** Shared invalidation facts prepared before retained HTML content writes. */
export interface HtmlPresentationContentWriteProducts {
  /** Canonical layout dirty range derived from coalesced transactions. */
  readonly layoutDirtyRange: QuireLayoutDirtyRange | null;
  /** Canonical update patch shared with the renderer-neutral render build. */
  readonly updatePatch: QuireViewUpdatePatch;
}

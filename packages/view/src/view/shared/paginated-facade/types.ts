import type { QuireRect } from "@quirekit/renderer";
import type {
  QuireClientRect,
  QuireDecorationSourceView,
  QuireDisplayListStyles,
  QuireLayoutSnapshot,
  QuireSelectionGeometryContext,
  QuireSurfaceConfig,
  QuireViewUpdatePatch
} from "@quirekit/view-engine";
import type { MountedDrawingPreviewState } from "../drawing-interaction";
import type { QuireDrawingManipulatingState } from "@quirekit/view-engine";
import type { QuireViewRenderResult } from "../../types";
import type { QuireViewBuildOptions } from "../../types";
import type { MountedPaginatedDocumentRenderRequest } from "../paginated-render-flow";
import type {
  QuireViewCoordsAtPosResult,
  QuireViewPosAtCoordsResult,
  QuireViewResolvedCoordsAtPos,
  QuireViewViewportCoords
} from "../geometry";
import type { MountedViewScrollRect } from "../scroll";
import type {
  QuireMountedEditorView,
  QuireMountedCaretMode,
  QuireMountedCaretRenderingMode
} from "../types";

/** Current client/document coordinate mapping for a paginated mounted surface. */
export interface MountedPaginatedSurfaceGeometry {
  /** Surface rectangle in viewport CSS pixels. */
  readonly clientRect: QuireClientRect;
  /** Document-space bounds represented by the surface, when materialized. */
  readonly surfaceBounds?: QuireRect | undefined;
}

/** Context supplied to an optional backend hit-test refinement. */
export interface MountedPaginatedPosAtCoordsRefinementContext {
  /** Canonical retained interaction snapshot. */
  readonly geometrySnapshot: QuireViewRenderResult["interactionSnapshot"];
  /** Viewport coordinates requested by the mounted facade. */
  readonly coords: QuireViewViewportCoords;
  /** Current surface coordinate mapping. */
  readonly surface: MountedPaginatedSurfaceGeometry;
  /** Retained hit-test result used when the backend has no better answer. */
  readonly retainedResult: QuireViewPosAtCoordsResult | null;
}

/** Context supplied to an optional backend position-rectangle refinement. */
export interface MountedPaginatedCoordsAtPosRefinementContext {
  /** Canonical retained interaction snapshot. */
  readonly geometrySnapshot: QuireViewRenderResult["interactionSnapshot"];
  /** Document position requested by the mounted facade. */
  readonly pos: number;
  /** Side preference at an ambiguous document boundary. */
  readonly side: number;
  /** Retained visual-instance context for repeated layout fragments. */
  readonly selectionContext?: QuireSelectionGeometryContext | undefined;
  /** Current surface coordinate mapping. */
  readonly surface: MountedPaginatedSurfaceGeometry;
  /** Retained document/client result used when refinement is unavailable. */
  readonly retainedResult: QuireViewResolvedCoordsAtPos;
}

/** Options used to create a shared paginated mounted geometry facade. */
export interface CreateMountedPaginatedGeometryFacadeOptions {
  /** Human-readable backend label used by pre-render geometry errors. */
  readonly backendLabel: string;
  /** Reads the latest committed mounted render result. */
  readonly readRenderResult: () => QuireViewRenderResult | undefined;
  /** Reads the current mounted surface coordinate mapping. */
  readonly readSurface: () => MountedPaginatedSurfaceGeometry;
  /** Reads the retained visual-instance context for the active selection. */
  readonly readSelectionContext: () => QuireSelectionGeometryContext | undefined;
  /** Optionally refines retained hit testing through an exact backend capability. */
  readonly refinePosAtCoords?:
    | ((context: MountedPaginatedPosAtCoordsRefinementContext) =>
        QuireViewPosAtCoordsResult | null | undefined)
    | undefined;
  /** Optionally refines retained position geometry through an exact backend capability. */
  readonly refineCoordsAtPos?:
    | ((context: MountedPaginatedCoordsAtPosRefinementContext) =>
        QuireViewCoordsAtPosResult | null | undefined)
    | undefined;
}

/** Shared editor-facing geometry and scroll contract for paginated mounted views. */
export interface MountedPaginatedGeometryFacade extends Required<Pick<
  QuireMountedEditorView,
  "getCaretRect" | "getTextRangeRects" | "getStructuredRangeRects" | "getTextblockContentWidth" | "getObjectAnchor"
  | "resolveUIAnchor" | "getTableChrome"
  | "coordsAtPos" | "endOfTextblock"
>> {
  /** @param clientY - Pointer height in CSS pixels. @returns Exact nearby block occurrences. */
  queryBlockFragments(clientY: number): readonly import("@quirekit/core").QuireMountedBlockFragment[];
  /**
   * Maps viewport coordinates to a document position.
   *
   * @param coords - Viewport coordinates in CSS pixels.
   * @returns Nearest document position, or null before geometry exists.
   */
  posAtCoords(coords: QuireViewViewportCoords): QuireViewPosAtCoordsResult | null;
  /**
   * Resolves the current selection rectangle used by PM-style scrolling.
   *
   * @returns Client-space rectangle, or null before geometry exists.
   */
  resolveSelectionScrollRect(): MountedViewScrollRect | null;
  /**
   * Resolves a document position anchor used by PM-style scrolling.
   *
   * @param position - Document position that should become visible.
   * @returns Client-space rectangle, or null before geometry exists.
   */
  resolvePositionScrollRect(position: number): MountedViewScrollRect | null;
  /**
   * Resolves the page holding a position from the layout, including pages not rendered yet.
   *
   * @param position - Document position.
   * @returns Client-space page rectangle, or null without a paginated layout.
   */
  resolvePageScrollRect(position: number): MountedViewScrollRect | null;
}

/** Details supplied after a shared paginated selection-only render commits. */
export interface MountedPaginatedSelectionUpdateEvent {
  /** Committed render result carrying the latest transient presentation. */
  readonly renderResult: QuireViewRenderResult;
  /** Mounted update reason associated with the selection-only render. */
  readonly reason?: string | undefined;
}

/** Options used to create paginated transient presentation ownership. */
export interface CreateMountedPaginatedTransientPresentationOptions {
  /** Current mounted provider source used to prove selection reuse eligibility. */
  readonly decorationSourceView?: QuireDecorationSourceView | undefined;
  /** Document that owns an optional DOM caret. */
  readonly ownerDocument: Document;
  /** Document-space overlay host that receives an optional DOM caret. */
  readonly overlayHost: HTMLElement;
  /** Backend class name assigned to an optional DOM caret element. */
  readonly domCaretClassName: string;
  /** Selected caret presentation backend. */
  readonly caretRendering: QuireMountedCaretRenderingMode;
  /** Optional initial caret behavior. */
  readonly caretMode?: QuireMountedCaretMode | undefined;
  /** Reads the latest committed render result. */
  readonly readRenderResult: () => QuireViewRenderResult | undefined;
  /** Commits a transient render result as the mounted facade authority. */
  readonly commitRenderResult: (renderResult: QuireViewRenderResult) => void;
  /** Reads the current editor layout state. */
  readonly readState: () => QuireLayoutSnapshot["state"];
  /** Reads retained visual-instance context for the current selection. */
  readonly readSelectionContext: () => QuireSelectionGeometryContext | undefined;
  /** Reads whether the mounted view currently owns focus. */
  readonly readFocused: () => boolean;
  /** Reads whether the mounted view currently accepts editing. */
  readonly readEditable: () => boolean;
  /** Reads whether the mounted facade has entered teardown. */
  readonly readDestroyed: () => boolean;
  /** Commits focus ownership to the mounted facade. */
  readonly setFocusedState: (focused: boolean) => void;
  /** Reads the HTML or SVG pointer surface whose resting cursor should be synchronized. */
  readonly readPointerSurface: () => HTMLElement | SVGElement;
  /** Reports whether backend presentation resources can reuse selection-only state. */
  readonly isSelectionUpdateReady: () => boolean;
  /** Reads the exact current full-build inputs before selection reuse admission. */
  readonly readSelectionBuildOptions?: ((
    request: MountedPaginatedDocumentRenderRequest<string>
  ) => QuireViewBuildOptions | undefined) | undefined;
  /** Optionally refines retained selection geometry through an exact backend capability. */
  readonly refineSelectionRenderResult?:
    | ((renderResult: QuireViewRenderResult) => QuireViewRenderResult)
    | undefined;
  /** Commits widget targets derived from the transient render result. */
  readonly setWidgetTargets: (renderResult: QuireViewRenderResult) => void;
  /** Synchronizes the backend-owned hidden input proxy. */
  readonly syncInputProxy: (renderResult: QuireViewRenderResult) => void;
  /** Repaints backend overlay surfaces with the requested caret visibility. */
  readonly repaintOverlay: (caretVisible: boolean) => void;
  /** Repaints drawing content and chrome from one transient render result. */
  readonly repaintDrawingPreview: (
    renderResult: QuireViewRenderResult,
    caretVisible: boolean
  ) => void;
  /** Binds cached backend resources for the projected object command family before clipping. */
  readonly prepareDrawingPreviewContent?: QuireViewBuildOptions["displayListTransform"];
  /**
   * Optionally builds a full non-dispatched layout preview for one manipulation
   * frame. Returning undefined falls back to command-only projection.
   */
  readonly buildDrawingLayoutPreview?:
    | ((
        state: QuireDrawingManipulatingState,
        acceptedRenderResult: QuireViewRenderResult
      ) => QuireViewRenderResult | undefined)
    | undefined;
  /**
   * Optional animation-frame request hook for drawing preview coalescing.
   * Provide {@link cancelDrawingPreviewFrame} with this hook.
   *
   * @param callback - Preview callback to run on the next display frame.
   * @returns Opaque frame handle used for cancellation.
   */
  readonly requestDrawingPreviewFrame?:
    | ((callback: () => void) => number)
    | undefined;
  /**
   * Cancels a frame requested through
   * {@link requestDrawingPreviewFrame}.
   *
   * @param handle - Opaque frame handle returned by the request hook.
   */
  readonly cancelDrawingPreviewFrame?: ((handle: number) => void) | undefined;
  /** Receives a committed selection-only render for backend diagnostics. */
  readonly onSelectionUpdate?:
    | ((event: MountedPaginatedSelectionUpdateEvent) => void)
    | undefined;
  /** Optional display-list styles shared by selection and caret presentation. */
  readonly displayListStyles?: Partial<QuireDisplayListStyles> | undefined;
  /** Optional semantic surface styling shared by selection presentation. */
  readonly surfaceConfig?: QuireSurfaceConfig | undefined;
}

/** Options supplied when synchronizing presentation after a full render. */
export interface MountedPaginatedTransientRenderSyncOptions {
  /** Caret visibility already painted by the backend overlay pass. */
  readonly overlayPaintedCaretVisible?: boolean | undefined;
}

/** Canonical transient presentation lifecycle for paginated mounted views. */
export interface MountedPaginatedTransientPresentation {
  /**
   * Presents active drawing chrome, or restores accepted chrome on cancellation.
   *
   * @param state - Active manipulation state, or null to clear the preview.
   */
  setDrawingPreview(state: MountedDrawingPreviewState | null): void;
  /**
   * Reports whether a selection-only render may reuse retained content.
   *
   * @param reason - Mounted update reason to evaluate.
   * @param request - Current update facts, before optional fill planning.
   * @returns Whether transient presentation can update without full layout.
   */
  canReuseSelectionUpdate(
    reason?: string,
    request?: MountedPaginatedDocumentRenderRequest<string>
  ): boolean;
  /**
   * Builds, commits, paints, and synchronizes a selection-only update.
   *
   * @param reason - Mounted update reason used by diagnostics.
   * @param updatePatch - Typed invalidation associated with the update.
   * @returns Committed transient render result.
   */
  renderSelectionUpdate(
    reason: string | undefined,
    updatePatch: QuireViewUpdatePatch | null | undefined
  ): QuireViewRenderResult;
  /**
   * Synchronizes transient presentation after a backend full render.
   *
   * @param options - Optional caret visibility already painted by the backend.
   */
  syncAfterRender(options?: MountedPaginatedTransientRenderSyncOptions): void;
  /**
   * Updates mounted focus ownership and caret presentation.
   *
   * @param focused - Whether this mounted view owns keyboard focus.
   */
  setFocused(focused: boolean): void;
  /**
   * Changes caret behavior without changing its presentation backend.
   *
   * @param mode - Caret mode to apply.
   */
  setCaretMode(mode: QuireMountedCaretMode): void;
  /** Active caret behavior. */
  readonly caretMode: QuireMountedCaretMode;
  /**
   * Reads visibility used by the next overlay repaint.
   *
   * @returns Whether overlay caret commands should paint.
   */
  overlayCaretVisible(): boolean;
  /** Releases caret presentation resources. */
  destroy(): void;
}

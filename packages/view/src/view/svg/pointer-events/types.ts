import type {
  QuireClientPoint,
  QuireClientRect,
  QuireHitTestResult
} from "@quirekit/view-engine";
import type { QuireViewRenderResult } from "../../types";
import type { MountedPointerSessionCallbacks } from "../../shared";
import type {
  SvgMountedView,
  SvgMountedViewElements,
  SvgMountedViewRuntimeOptions
} from "../types";
import type { SvgMountedRenderSurfaceState } from "../surface";

/** Current render state required by mounted SVG pointer event handlers. */
export interface SvgMountedPointerRenderState {
  /** Latest render result with layout and selection geometry. */
  readonly renderResult: QuireViewRenderResult;
  /** Current SVG surface state. */
  readonly surfaceState: SvgMountedRenderSurfaceState;
}

/** Inputs used to hit-test mounted SVG pointer coordinates. */
export interface SvgMountedPointerHitTestRequest {
  /** Pointer client point to resolve. */
  readonly clientPoint: QuireClientPoint;
  /** Current render state used for layout and SVG text roots. */
  readonly renderState: SvgMountedPointerRenderState;
  /** Client rectangle of the mounted SVG coordinate surface. */
  readonly surfaceClientRect: QuireClientRect;
}

/** Options used to bind mounted SVG pointer events. */
export interface BindSvgMountedPointerEventsOptions extends MountedPointerSessionCallbacks {
  /** Mounted editor view receiving pointer input. */
  readonly mountedView: SvgMountedView;
  /** Elements owned by the mounted SVG view. */
  readonly elements: SvgMountedViewElements;
  /** Optional runtime callbacks and display-list styles. */
  readonly runtime?: SvgMountedViewRuntimeOptions | undefined;
  /**
   * Reads the latest render state.
   *
   * @returns Current render state, or null before the first render.
   */
  readonly getRenderState: () => SvgMountedPointerRenderState | null;
  /**
   * Resolves a pointer hit-test through SVG-owned geometry.
   *
   * @param request - Pointer point, render state, and coordinate surface.
   * @returns Hit-test result for the pointer point.
   */
  readonly hitTestPointer: (
    request: SvgMountedPointerHitTestRequest
  ) => QuireHitTestResult;
}

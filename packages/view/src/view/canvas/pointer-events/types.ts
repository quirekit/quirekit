import type { QuireView } from "../../facade";
import type { QuireViewRenderResult } from "../../types";
import type { MountedPointerSessionCallbacks } from "../../shared";
import type {
  CanvasMountedView,
  CanvasMountedViewElements,
  CanvasMountedViewRuntimeOptions
} from "../types";
import type { CanvasMountedRenderSurfaceState } from "../surface";

/** Current render state required by mounted pointer event handlers. */
export interface CanvasMountedPointerRenderState {
  /** Latest render result with layout and selection geometry. */
  readonly renderResult: QuireViewRenderResult;
  /** Current canvas surface state. */
  readonly surfaceState: CanvasMountedRenderSurfaceState;
}

/** Options used to bind mounted canvas pointer events. */
export interface BindCanvasMountedPointerEventsOptions extends MountedPointerSessionCallbacks {
  /** Mounted editor view receiving pointer input. */
  readonly mountedView: CanvasMountedView;
  /** Canvas view facade used for hit testing and selection updates. */
  readonly canvasView: QuireView;
  /** Elements owned by the mounted canvas view. */
  readonly elements: CanvasMountedViewElements;
  /** Optional runtime callbacks and display-list styles. */
  readonly runtime?: CanvasMountedViewRuntimeOptions | undefined;
  /**
   * Reads the latest render state.
   *
   * @returns Current render state, or null before the first render.
   */
  readonly getRenderState: () => CanvasMountedPointerRenderState | null;
}

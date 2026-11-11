import type { QuireRect } from "@quirekit/renderer";
import type { QuireEditorInputBinding } from "../../../../input";
import type {
  QuireHitTestResult,
  QuireInteractionSelectionTarget,
  QuireSelectionGeometryContext
} from "@quirekit/view-engine";
import type {
  QuireViewPointerHitTestResult,
  QuireViewPointerSelectionOptions,
  QuireViewRenderResult
} from "../../../types";
import type { QuireMountedEditorView } from "../../types";
import type { MountedWidgetEventRuntime } from "../../widget-events";
import type { MountedPointerDragState } from "../drag";
import type { MountedDrawingCreationPointerEvent } from "../../drawing-interaction";
import type {
  CreateMountedPointerAutoScrollControllerOptions,
  MountedPointerAutoScrollController
} from "../auto-scroll";
import type { MountedHeaderFooterPointerSelectionPreparation } from "../../header-footer-editing";

/** Render products required by the shared mounted pointer session. */
export interface MountedPointerSessionRenderState {
  /** Latest renderer-neutral geometry and selection products. */
  readonly renderResult: Pick<QuireViewRenderResult, "layoutSnapshot" | "interactionSnapshot" | "selectionGeometry" | "selectionContext">;
  /** Mounted surface geometry used for client/document projection. */
  readonly surfaceState: Readonly<{
    /** Document-space bounds represented by the coordinate surface. */
    surfaceBounds: QuireRect;
  }>;
}

/** How pointer selection synchronizes mounted presentation after local state changes. */
export type MountedPointerSelectionRenderMode =
  | "request"
  | "flush-pending";

/** Options that bind one renderer-neutral mounted pointer session. */
export interface BindMountedPointerSessionOptions {
  /** Mounted editor view receiving pointer selection and plugin props. */
  readonly mountedView: QuireMountedEditorView;
  /** Root whose document owns native selection and continuation events. */
  readonly root: HTMLElement;
  /** Surface used for client/document coordinate projection and pointer capture. */
  readonly coordinateSurface: HTMLElement | SVGSVGElement;
  /** Surface whose CSS cursor reflects the current pointer target. */
  readonly cursorSurface: HTMLElement | SVGSVGElement;
  /** Event targets that start or continue surface-local pointer sessions. */
  readonly eventTargets: readonly EventTarget[];
  /** Target whose pointer leave event clears hover diagnostics. */
  readonly leaveTarget: EventTarget;
  /** Widget event runtime used to dispatch retained renderer targets. */
  readonly widgetEvents: MountedWidgetEventRuntime;
  /**
   * Reads the current render products.
   *
   * @returns Current products, or null before the first render.
   */
  readonly getRenderState: () => MountedPointerSessionRenderState | null;
  /**
   * Reads the native input binding owned by the mounted view.
   *
   * @returns Active input binding, or undefined for non-editable views.
   */
  readonly getInputBinding: () => QuireEditorInputBinding | undefined;
  /**
   * Reads the current interaction target before and after retained actions.
   *
   * @returns Active command-routing target, or null when none is installed.
   */
  readonly getInteractionTarget: () => QuireInteractionSelectionTarget | null;
  /** Focuses the mounted editor input target. */
  readonly focus: () => void;
  /**
   * Synchronizes selection presentation without duplicating transaction-owned work.
   *
   * @param mode - Whether to request a view-local render or flush an existing transaction render.
   */
  readonly renderSelection: (mode: MountedPointerSelectionRenderMode) => void;
  /**
   * Stores the interaction target used for subsequent command routing.
   *
   * @param target - Active target, or null when the pointer misses.
   */
  readonly setInteractionTarget: (
    target: QuireInteractionSelectionTarget | null
  ) => void;
  /**
   * Stores retained geometry context used to materialize selection visuals.
   *
   * @param context - Retained context, or undefined without retained facts.
   */
  readonly setSelectionGeometryContext: (
    context: QuireSelectionGeometryContext | undefined
  ) => void;
  /**
   * Gates pointer selection through explicit header/footer editing ownership.
   *
   * @param target - Retained target produced by the current hit test.
   * @param clickCount - Normalized consecutive pointer click count.
   * @returns Whether the gesture is blocked, allowed, or changes editing domain.
   */
  readonly prepareHeaderFooterPointerSelection?:
    | ((
        target: QuireInteractionSelectionTarget | null,
        clickCount: number
      ) => MountedHeaderFooterPointerSelectionPreparation)
    | undefined;
  /**
   * Routes armed drawing creation before ordinary retained selection.
   *
   * @param event - Shared client/document pointer facts.
   * @returns Whether drawing creation consumed the event.
   */
  readonly handleDrawingCreationPointer?:
    | ((event: MountedDrawingCreationPointerEvent) => boolean)
    | undefined;
  /**
   * Reports whether drawing creation owns hover and capture cursor feedback.
   *
   * @returns Whether a creation tool is armed or captured.
   */
  readonly isDrawingCreationActive?: (() => boolean) | undefined;
  /**
   * Resolves one pointer point through the backend geometry authority.
   *
   * @param options - Renderer-neutral pointer selection options.
   * @param renderState - Products from the render pass owning the pointer event.
   * @returns Hit, interaction target, and geometry snapshot from one authority.
   */
  readonly hitTestPointer: (
    options: QuireViewPointerSelectionOptions,
    renderState: MountedPointerSessionRenderState
  ) => QuireViewPointerHitTestResult;
  /**
   * Emits the latest pointer hit for diagnostics.
   *
   * @param hitTestResult - Latest renderer-neutral hit result.
   */
  readonly onPointerHitTest: (hitTestResult: QuireHitTestResult) => void;
  /**
   * Lets retained custom DOM views consume native events before editor handling.
   *
   * @param event - Native event to classify.
   * @returns Whether editor pointer handling must stop.
   */
  readonly stopEvent?: ((event: Event) => boolean) | undefined;
  /** Whether retained qkView target cursors participate in cursor resolution. */
  readonly useWidgetTargetCursor?: boolean | undefined;
  /** Whether pointer leave clears the cursor style owned by this session. */
  readonly clearCursorOnLeave?: boolean | undefined;
  /**
   * Optional auto-scroll factory used by deterministic pointer-session tests.
   *
   * Production backends omit this and share the default mounted controller.
   */
  readonly createPointerAutoScrollController?:
    | ((
        options: CreateMountedPointerAutoScrollControllerOptions
      ) => MountedPointerAutoScrollController)
    | undefined;
  /**
   * Optional animation-frame scheduler used by deterministic drag tests.
   *
   * @param callback - Callback to run on the next active-drag frame.
   * @returns Cancelable frame handle.
   */
  readonly requestPointerDragFrame?:
    | ((callback: FrameRequestCallback) => number)
    | undefined;
  /**
   * Optional cancellation paired with `requestPointerDragFrame`.
   *
   * @param handle - Active-drag frame handle to cancel.
   */
  readonly cancelPointerDragFrame?: ((handle: number) => void) | undefined;
}

/** Selection, focus and diagnostics callbacks every backend supplies to its pointer binding. */
export type MountedPointerSessionCallbacks = Pick<BindMountedPointerSessionOptions,
  | "widgetEvents" | "getInputBinding" | "getInteractionTarget" | "focus" | "renderSelection"
  | "setInteractionTarget" | "setSelectionGeometryContext" | "prepareHeaderFooterPointerSelection"
  | "handleDrawingCreationPointer" | "isDrawingCreationActive" | "onPointerHitTest">;

/** Inputs used to process one pointerdown inside a mounted pointer session. */
export interface HandleMountedPointerDownOptions {
  /** Shared mounted pointer session capabilities. */
  readonly bindingOptions: BindMountedPointerSessionOptions;
  /** Browser pointerdown event to process. */
  readonly event: PointerEvent;
  /** Normalized consecutive click count. */
  readonly clickCount: number;
  /** Render products owning this event. */
  readonly renderState: MountedPointerSessionRenderState;
  /**
   * Starts the active drag or retained-target capture session.
   *
   * @param state - Pointer session state to retain until pointer end.
   */
  readonly setPointerDragState: (state: MountedPointerDragState) => void;
}

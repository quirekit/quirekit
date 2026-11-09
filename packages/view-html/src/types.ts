import type {
  QuireMountedEditorView,
  QuireMountedEditorViewElements,
  QuireMountedEditorViewOptions,
  QuireMountedEditorViewUpdateOptions,
  QuireMountedViewportPadding,
  QuireViewAdapter,
  MountedViewUpdateSchedulerCounters
} from "@quirekit/view/mounted-backend";
import type {
  QuireDisplayListStyles,
  QuireHiddenTextViewMode,
  QuireSurfaceConfig
} from "@quirekit/view-engine";
import type { QuireRect } from "@quirekit/renderer";
import type { QuireHitTestResult } from "@quirekit/view-engine";
import type { QuireMountedViewRenderEvent } from "@quirekit/view/mounted-backend";
import type { HtmlFlowRenderResult } from "./geometry/types";

/** Retained content-write counters emitted by one HTML render. */
export interface HtmlMountedContentWriteDiagnostics {
  /** Direct retained text writes. */
  readonly text: number;
  /** Direct schema and decoration attribute writes. */
  readonly attributes: number;
  /** Direct retained child-list writes. */
  readonly structure: number;
  /** Session-owned in-flow composition writes. */
  readonly composition: number;
}

/** Bounded unauthorized-mutation counters emitted by HTML renders. */
export interface HtmlMountedMutationDiagnostics {
  /** Observer records drained after authorized writes. */
  readonly ownedRecordsDrained: number;
  /** Unauthorized owner scopes restored. */
  readonly recoveries: number;
  /** Custom-view records accepted by ignoreMutation. */
  readonly ignoredNodeViewRecords: number;
  /** Internal DOM updates owned by keyed widgets. */
  readonly ignoredWidgetRecords: number;
  /** Recovery-generated observer records drained. */
  readonly recoveryRecordsDrained: number;
  /** Recoveries rejected by the per-owner retry bound. */
  readonly recoveryLimitHits: number;
}

/** Typed retained HTML evidence attached to a completed render event. */
export interface HtmlMountedRenderDiagnostics {
  /** Whether this render rebuilt the DOM block-geometry snapshot. */
  readonly flowGeometryRebuilt: boolean;
  /** Native geometry measurements and retained spatial-index work in this presentation. */
  readonly geometry: import("./geometry/retained").HtmlFlowGeometryDiagnostics;
  /** Confirms that the shared-cadence HTML scheduler produced this event. */
  readonly schedulerEvidence: "available";
  /** Shared mounted scheduler counters sampled after this render. */
  readonly scheduler: MountedViewUpdateSchedulerCounters;
  /** Ordered state versions absorbed by the render. */
  readonly stateVersions: readonly number[];
  /** Retained reconciliation passes performed by the render. */
  readonly reconciliationFrames: number;
  /** Descriptor targets visited by bounded reconciliation. */
  readonly descriptorVisits: number;
  /** Custom NodeView update calls attempted. */
  readonly nodeViewUpdateAttempts: number;
  /** Authorized direct DOM writes split by mutation kind. */
  readonly contentWrites: HtmlMountedContentWriteDiagnostics;
  /** Composition sessions ended by explicit retained-ownership gaps. */
  readonly compositionGaps: number;
  /** DOM Range geometry reads performed by this render. */
  readonly rangeReads: number;
  /** Geometry reads rejected during a write phase. */
  readonly forcedLayoutRisks: number;
  /** Times the immortal retained root ceased to be the exact mounted child. */
  readonly rootReplacements: number;
  /** Bounded mutation-observation evidence. */
  readonly mutations: HtmlMountedMutationDiagnostics;
}

/** Render event emitted specifically by the retained HTML backend. */
export interface HtmlMountedViewRenderEvent extends QuireMountedViewRenderEvent<HtmlFlowRenderResult> {
  /** Mounted HTML view that produced the render. */
  readonly view: HtmlMountedView;
  /** Required retained scheduler and mutation evidence. */
  readonly diagnostics: HtmlMountedRenderDiagnostics;
}

/** DOM elements owned by a mounted HTML editor view. */
export interface HtmlMountedViewElements extends QuireMountedEditorViewElements {
  /** Root element owned by this mounted HTML view. */
  readonly root: HTMLElement;
  /** HTMLElement that renders document content through DOM nodes. */
  readonly contentSurface: HTMLElement;
  /** SVG surface for auxiliary decorations; model selection owns a separate SVG pool. */
  readonly overlaySurface: SVGSVGElement;
  /** DOM host for positioned overlays, the SVG selection surface, and the shared caret. */
  readonly overlayHost: HTMLElement;
  /** Text input proxy used by keyboard, IME, and clipboard events. */
  readonly inputProxy: HTMLTextAreaElement;
}

/** Event emitted after pointer hit testing in a mounted HTML view. */
export interface HtmlMountedViewPointerHitTestEvent {
  /** Mounted view that processed the pointer event. */
  readonly view: HtmlMountedView;
  /** Hit-test result produced from the latest layout snapshot. */
  readonly hitTestResult: QuireHitTestResult;
}

/** Runtime options specific to a mounted HTML editor view. */
export interface HtmlMountedViewRuntimeOptions {
  /** Preferred CSS pixel width for the mounted HTML surface. */
  readonly width?: number | undefined;
  /** Preferred CSS pixel height for the mounted HTML surface. */
  readonly height?: number | undefined;
  /** Optional viewport rectangle used when rendering mounted HTML content. */
  readonly viewportRect?: QuireRect | undefined;
  /** Insets used to derive the viewport from the current HTML display size. */
  readonly viewportPadding?: QuireMountedViewportPadding | undefined;
  /** Optional display-list style overrides applied to mounted HTML renders. */
  readonly displayListStyles?: Partial<QuireDisplayListStyles> | undefined;
  /** Optional semantic surface styling for selection and IME affordances. */
  readonly surfaceConfig?: QuireSurfaceConfig | undefined;
  /** Initial hidden-text presentation policy. Defaults to `normal`. */
  readonly hiddenTextViewMode?: QuireHiddenTextViewMode | undefined;
  /**
   * Observes this view's render passes, e.g. to size the surface from the
   * rendered document height instead of rebuilding a layout snapshot.
   *
   * @param event - Render event produced by this mounted view.
   */
  readonly onRender?: ((event: HtmlMountedViewRenderEvent) => void) | undefined;
  /**
   * Observes pointer hit-test results for diagnostics.
   *
   * @param event - Pointer hit-test event produced by this mounted view.
   */
  readonly onPointerHitTest?:
    | ((event: HtmlMountedViewPointerHitTestEvent) => void)
    | undefined;
  /**
   * Observes focus changes for diagnostics or outer UI state.
   *
   * @param focused - Whether this mounted view input proxy is focused.
   */
  readonly onFocusChange?: ((focused: boolean) => void) | undefined;
}

/** Options used to create a mounted HTML editor view. */
export interface HtmlMountedViewOptions
  extends Omit<QuireMountedEditorViewOptions, "mode"> {
  /** Runtime sizing options for the HTML and SVG overlay surfaces. */
  readonly runtime?: HtmlMountedViewRuntimeOptions | undefined;
}

/** Mounted HTML editor view lifecycle contract. */
export interface HtmlMountedView extends QuireMountedEditorView {
  /** View backend mode implemented by this mounted view. */
  readonly mode: "html";
  /** Elements created or claimed by this mounted HTML view. */
  readonly elements: HtmlMountedViewElements;
  /**
   * Finds the rendered DOM position for a document position.
   *
   * @param pos - Document position to map.
   * @param side - Side preference for boundary positions.
   * @returns DOM node and offset for the requested position.
   */
  domAtPos(pos: number, side?: number): { readonly node: Node; readonly offset: number };
  /**
   * Finds the rendered DOM node for the document node after a position.
   *
   * @param pos - Document position before the node.
   * @returns Rendered DOM node, or null when unavailable.
   */
  nodeDOM(pos: number): Node | null;
  /**
   * Maps a DOM position inside the HTML content tree to a document position.
   *
   * @param node - DOM node inside the HTML content surface.
   * @param offset - DOM offset inside the node.
   * @param bias - Side bias for ambiguous boundary positions.
   * @returns Document position represented by the DOM position.
   */
  posAtDOM(node: Node, offset: number, bias?: number): number;
  /**
   * Renders the latest shared editor state into this mounted HTML view.
   *
   * @param options - Shared editor state and update reason.
   */
  update(options: QuireMountedEditorViewUpdateOptions): void;
}

/** Options used to create an HTML view adapter. */
export interface HtmlViewAdapterOptions {
  /** Runtime sizing options applied when the adapter mounts an HTML view. */
  readonly runtime?: HtmlMountedViewRuntimeOptions | undefined;
}

/** View adapter contract for the HTML editor runtime. */
export interface HtmlViewAdapter extends QuireViewAdapter {
  /** View mode handled by this adapter. */
  readonly mode: "html";
  /**
   * Mounts an HTML editor view.
   *
   * @param options - Editor state, mount element, identity, and runtime status.
   * @returns Mounted HTML editor view.
   */
  mount(options: QuireMountedEditorViewOptions): HtmlMountedView;
}

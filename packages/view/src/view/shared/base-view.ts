import type {
  QuireDocumentRange,
  QuirePoint,
  QuireViewWidget,
  QuireViewWidgetHit
} from "@quirekit/renderer";
import type { QuireMountedInteractionTargetSnapshot, QuireScrollIntoViewOptions } from "@quirekit/core";
import type {
  EditorProps as PMEditorProps,
  EditorState as PMEditorState,
  Slice,
  Transaction
} from "@quirekit/pm";
import { pasteQuireClipboardHtml, pasteQuireClipboardText } from "@quirekit/clipboard";
import { dispatchQuirePluginDomEvent } from "../../input/controller/events/dispatch";
import { MountedPluginViewLifecycle } from "./plugin-view-lifecycle";
import { serializeMountedViewClipboard, type MountedViewClipboardPayload } from "./clipboard";
import { MountedViewServices } from "../../mounted-services/runtime";
import { suspendVisualAccessibility } from "../../mounted-services/visual-exposure";
import type { QuireMountedTextActivationOptions, QuireMountedTextTarget } from "../../mounted-services/types";
import type { QuireTextContextHost } from "../../input/text-context/types";
import { syncMountedInputProxyEditableState } from "./input-proxy";
import { resolveMountedViewRoot } from "./root";
import {
  createMountedViewScrollController
} from "./scroll";
import type {
  QuireViewCoordsAtPosResult,
  QuireViewPosAtCoordsResult,
  QuireViewTextblockDirection,
  QuireViewViewportCoords
} from "./geometry";
import type { MountedViewScrollRect } from "./scroll";
import type {
  BaseMountedEditorViewOptions,
  QuireEditorViewStatus,
  QuireMountedEditorView,
  QuireMountedEditorViewElements,
  QuireMountedEditorViewProps,
  QuireMountedEditorViewUpdateOptions,
  QuireViewMode
} from "./types";
import type { MountedWidgetEventRuntime } from "./widget-events";
import type { QuireMountedTableChromeModel } from "./table-chrome";

/**
 * Shared PM-like facade for Canvas, SVG, and HTML mounted views.
 *
 * Concrete modes provide surfaces, input bindings, hit testing, and rendering
 * through protected hooks. The base owns editor-facing lifecycle invariants so
 * PM compatibility methods can be added once.
 */
export abstract class BaseMountedEditorView<
  Mode extends QuireViewMode,
  Elements extends QuireMountedEditorViewElements
> implements QuireMountedEditorView {
  /** @inheritdoc */
  abstract readonly hiddenTextViewMode: QuireMountedEditorView["hiddenTextViewMode"];

  /** @inheritdoc */
  abstract setHiddenTextViewMode(
    mode: QuireMountedEditorView["hiddenTextViewMode"]
  ): void;

  /** Stable view identity used for registries and diagnostics. */
  readonly id: string;
  /** View backend mode implemented by this mounted view. */
  readonly mode: Mode;
  /** Runtime status that controls whether this view may edit shared state. */
  readonly status: QuireEditorViewStatus;
  /** Elements created or claimed by this mounted view. */
  readonly elements: Elements;
  /** Editor whose state and transactions drive this mounted view. */
  protected readonly editor: BaseMountedEditorViewOptions<Mode, Elements>["editor"];
  private readonly pluginViewLifecycle = new MountedPluginViewLifecycle();
  private readonly mountedServices = new MountedViewServices();
  private readonly geometryUpdateListeners = new Set<() => void>();
  private viewPropsValue: Partial<PMEditorProps> = {};
  private rootValue: Document | ShadowRoot | undefined;
  private widgetEventsValue: MountedWidgetEventRuntime | undefined;
  private focused = false;
  private destroyed = false;

  /**
   * Creates the shared mounted editor view facade.
   *
   * @param options - Editor, identity, mode, status, and owned elements.
   */
  constructor(options: BaseMountedEditorViewOptions<Mode, Elements>) {
    this.editor = options.editor;
    this.id = options.id;
    this.mode = options.mode;
    this.status = options.status;
    this.elements = options.elements;
    this.scrolling.acceptScrollRequests();
    this.syncInputProxyEditableState();
  }

  /**
   * Current ProseMirror editor state exposed to plugin props.
   *
   * @returns Latest shared ProseMirror editor state.
   */
  get state(): PMEditorState {
    return this.editor.state.pm;
  }

  /**
   * Current direct props snapshot exposed by this mounted view.
   *
   * @returns View-local props merged with the current shared PM state.
   */
  get props(): QuireMountedEditorViewProps {
    return {
      ...this.viewPropsValue,
      state: this.state
    };
  }

  /**
   * PM-compatible root DOM element for plugins that read `view.dom`.
   *
   * @returns Mounted view root element.
   */
  get dom(): HTMLElement {
    return this.elements.root;
  }

  /**
   * Reports whether this mounted view currently accepts editing input.
   *
   * @returns Whether the owning editor is editable and the view is not locked.
   */
  get editable(): boolean {
    if (this.status === "lock" || !this.editor.isEditable) {
      return false;
    }

    return !this.hasEditablePropDisabledEditing();
  }

  /**
   * Document or shadow root that owns the mounted view.
   *
   * @returns Current document or shadow root for this mounted view.
   */
  get root(): Document | ShadowRoot {
    this.rootValue ??= resolveMountedViewRoot(this.elements.root);

    return this.rootValue;
  }

  /** Focuses the mounted input for selection and copy unless the view is locked. */
  focus(): void {
    if (this.status === "lock" || this.destroyed) {
      return;
    }

    this.focusEditableTarget();
  }

  /**
   * Dispatches a ProseMirror transaction through the owning editor.
   *
   * @param transaction - Transaction to apply to the shared editor state.
   */
  dispatch(transaction: Transaction): void {
    if (this.status === "lock" || this.destroyed) {
      return;
    }

    this.editor.dispatchTransaction(transaction);
  }

  /**
   * Reports whether this mounted view owns keyboard focus.
   *
   * @returns Whether the mounted view input target is focused.
   */
  hasFocus(): boolean {
    const inputProxy = this.elements.inputProxy;

    return (
      this.focused ||
      (inputProxy !== undefined &&
        this.elements.root.ownerDocument.activeElement === inputProxy)
    );
  }

  /**
   * Resolves a ProseMirror-style view prop contributed by installed plugins.
   *
   * @param propName - View prop name to read.
   * @param f - Optional callback invoked for each defined prop value until it
   * returns a truthy result.
   * @returns Callback result or undefined when no prop handles the request.
   */
  someProp<PropName extends keyof PMEditorProps, Result>(
    propName: PropName,
    f: (value: NonNullable<PMEditorProps[PropName]>) => Result
  ): Result | undefined;
  /**
   * Resolves the first defined ProseMirror-style view prop contributed by
   * installed plugins.
   *
   * @param propName - View prop name to read.
   * @returns First truthy prop value, or undefined when none is available.
   */
  someProp<PropName extends keyof PMEditorProps>(
    propName: PropName
  ): NonNullable<PMEditorProps[PropName]> | undefined;
  someProp<PropName extends keyof PMEditorProps, Result>(
    propName: PropName,
    f?: (value: NonNullable<PMEditorProps[PropName]>) => Result
  ): Result | NonNullable<PMEditorProps[PropName]> | undefined {
    const directProp = this.viewPropsValue[propName];

    if (directProp != null) {
      const value = f
        ? f(directProp as NonNullable<PMEditorProps[PropName]>)
        : directProp;

      if (value) {
        return value as Result | NonNullable<PMEditorProps[PropName]>;
      }
    }

    return f ? this.editor.someProp(propName, f) : this.editor.someProp(propName);
  }

  /**
   * Updates view-local direct props and refreshes this mounted view.
   *
   * @param props - ProseMirror-style view props to merge into this mounted view.
   */
  setProps(props: Partial<PMEditorProps>): void {
    if (this.destroyed) {
      return;
    }

    this.viewPropsValue = {
      ...this.viewPropsValue,
      ...props
    };
    this.refreshMountedView({ editor: this.editor, reason: "transaction" });
  }

  /** Clears cached root information after the mounted view moves across DOM roots. */
  updateRoot(): void {
    this.rootValue = undefined;
  }

  /**
   * Refreshes this mounted view from the current shared editor state.
   *
   * @param state - ProseMirror state expected to be the editor's current state.
   */
  updateState(state: PMEditorState): void {
    if (this.destroyed) {
      return;
    }

    if (state !== this.editor.state.pm) {
      throw new RangeError(
        "Mounted view updateState() cannot replace QuireKit shared editor state. Dispatch a transaction through view.dispatch() instead."
      );
    }

    this.refreshMountedView({ editor: this.editor, reason: "transaction" });
  }

  /** Clears host font metrics and refreshes layout after external font registration. */
  refreshFontMetrics(): void {
    if (this.destroyed) return;
    this.refreshMountedView({ editor: this.editor, reason: "transaction" });
  }

  /**
   * Routes a DOM event through ProseMirror-style direct and plugin event props.
   *
   * @param event - DOM event to dispatch through mounted view handlers.
   * @returns Whether a handler consumed the event.
   */
  dispatchEvent(event: Event): boolean {
    if (this.destroyed) {
      return false;
    }

    return dispatchQuirePluginDomEvent(this, event);
  }

  /**
   * Runs the mounted view paste pipeline with an HTML payload.
   *
   * @param html - HTML clipboard payload to parse and paste.
   * @param event - Optional clipboard event that initiated the paste.
   * @returns Whether the paste was handled.
   */
  pasteHTML(html: string, event?: ClipboardEvent): boolean {
    if (this.status === "lock" || this.destroyed) {
      return false;
    }

    return pasteQuireClipboardHtml(this.editor, html, event, this);
  }

  /**
   * Runs the mounted view paste pipeline with plain text.
   *
   * @param text - Plain text clipboard payload to paste.
   * @param event - Optional clipboard event that initiated the paste.
   * @returns Whether the paste was handled.
   */
  pasteText(text: string, event?: ClipboardEvent): boolean {
    if (this.status === "lock" || this.destroyed) {
      return false;
    }

    return pasteQuireClipboardText(this.editor, text, event, this);
  }

  /**
   * Scrolls the current selection into view through PM-style handlers, page first without rendered geometry.
   *
   * @param options - Alignment and margin; omitted keeps the PM default.
   * @returns Whether scrolling was handled or a selection rectangle was available.
   */
  scrollToSelection(options?: QuireScrollIntoViewOptions): boolean {
    return !this.destroyed && this.scrolling.scrollToSelection(options);
  }

  /**
   * Scrolls a document range into view without changing the selection.
   *
   * @param range - Document range to reveal.
   * @param options - Alignment and margin.
   * @returns Whether geometry for the range was found and scrolling started.
   */
  scrollRangeIntoView(range: { readonly from: number; readonly to: number }, options: QuireScrollIntoViewOptions = {}): boolean {
    return !this.destroyed && this.scrolling.scrollRangeIntoView(range, options);
  }

  /** Selection and range scrolling bound to this view's geometry. */
  private readonly scrolling = createMountedViewScrollController(this, {
    resolveSelectionRect: () => this.resolveMountedSelectionScrollRect(),
    resolvePositionRect: position => this.resolveMountedPositionScrollRect(position),
    resolvePageRect: position => this.resolveMountedPageScrollRect(position),
    onGeometryUpdate: listener => this.onGeometryUpdate(listener)
  });

  /**
   * Serializes a slice using the mounted view clipboard pipeline.
   *
   * @param slice - Slice to serialize for external clipboard consumers.
   * @returns DOM, text, and transformed slice payloads.
   */
  serializeForClipboard(slice: Slice): MountedViewClipboardPayload {
    return serializeMountedViewClipboard(this.editor, this, slice, this.elements.root.ownerDocument);
  }

  /**
   * Reads virtual widget objects for the latest render result.
   *
   * @returns Widgets in compiler output order.
   */
  getWidgets(): readonly QuireViewWidget[] {
    return this.destroyed ? [] : this.widgetEventsValue?.getWidgets() ?? [];
  }

  /**
   * Finds a widget by id.
   *
   * @param id - Widget id to search.
   * @returns Widget with the requested id, or undefined.
   */
  getWidgetById(id: string): QuireViewWidget | undefined {
    return this.destroyed ? undefined : this.widgetEventsValue?.getWidgetById(id);
  }

  /**
   * Finds widgets with a semantic role.
   *
   * @param role - Role to search.
   * @returns Widgets with the requested role in compiler output order.
   */
  getWidgetsByRole(role: string): readonly QuireViewWidget[] {
    return this.destroyed ? [] : this.widgetEventsValue?.getWidgetsByRole(role) ?? [];
  }

  /**
   * Finds widgets with a semantic part name.
   *
   * @param part - Part name to search.
   * @returns Widgets with the requested part in compiler output order.
   */
  getWidgetsByPart(part: string): readonly QuireViewWidget[] {
    return this.destroyed ? [] : this.widgetEventsValue?.getWidgetsByPart(part) ?? [];
  }

  /**
   * Finds widgets whose document range contains a position.
   *
   * @param position - Document position to search.
   * @returns Widgets containing the position in compiler output order.
   */
  getWidgetsByPosition(position: number): readonly QuireViewWidget[] {
    return this.destroyed ? [] : this.widgetEventsValue?.getWidgetsByPosition(position) ?? [];
  }

  /**
   * Finds widgets whose document range overlaps another range.
   *
   * @param range - Document range to search.
   * @returns Widgets overlapping the range in compiler output order.
   */
  getWidgetsByRange(range: QuireDocumentRange): readonly QuireViewWidget[] {
    return this.destroyed ? [] : this.widgetEventsValue?.getWidgetsByRange(range) ?? [];
  }

  /**
   * Hit-tests one renderer-space point against the latest widgets.
   *
   * @param point - Renderer-space point to test.
   * @returns Hit widget result, or null when no widget is hit.
   */
  widgetAtPoint(point: QuirePoint): QuireViewWidgetHit | null {
    return this.destroyed ? null : this.widgetEventsValue?.widgetAtPoint(point) ?? null;
  }

  /** Whether this mounted view has already been destroyed. */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Renders the latest shared editor state into this mounted view.
   *
   * @param options - Shared editor state and update reason.
   */
  update(options: QuireMountedEditorViewUpdateOptions): void {
    if (this.destroyed) {
      return;
    }

    this.refreshMountedView(options);
  }

  /** Tears down event listeners and DOM owned by this mounted view. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.scrolling.cancel();
    this.geometryUpdateListeners.clear();
    try { this.mountedServices.destroy(); }
    finally {
      try { this.pluginViewLifecycle.destroy(); }
      finally { this.destroyMountedView(); }
    }
  }

  /**
   * Updates the focus state tracked by the shared facade.
   *
   * @param focused - Whether this mounted view currently owns keyboard focus.
   */
  protected setMountedFocusState(focused: boolean): void {
    this.focused = focused;
  }

  /**
   * Reads the focus state tracked by the shared facade.
   *
   * @returns Whether the mounted view currently owns keyboard focus.
   */
  protected hasMountedFocusState(): boolean {
    return this.focused;
  }

  /**
   * Registers the qkView widget runtime used by public widget query methods.
   *
   * @param runtime - Mounted widget event runtime owned by the concrete view.
   */
  protected setMountedWidgetEventRuntime(runtime: MountedWidgetEventRuntime): void {
    this.widgetEventsValue = runtime;
  }

  /**
   * Reports whether public lifecycle methods should ignore runtime work.
   *
   * @returns Whether the mounted view has been destroyed.
   */
  protected isMountedViewDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Resolves the retained selection rectangle used by default PM-style scrolling.
   *
   * @returns Client-space selection rectangle, or null when the current backend has no retained render result.
   */
  protected resolveMountedSelectionScrollRect(): MountedViewScrollRect | null {
    return null;
  }

  /**
   * Resolves a retained position-anchor rectangle used by default PM-style scrolling.
   *
   * @param position - Document position that should become visible.
   * @returns Client-space position-anchor rectangle, or null when the current backend has no retained render result.
   */
  protected resolveMountedPositionScrollRect(
    position: number
  ): MountedViewScrollRect | null {
    void position;
    return null;
  }

  /**
   * Resolves the rectangle of the page holding a position, whether or not the page is rendered.
   *
   * @param position - Document position.
   * @returns Client-space page rectangle, or null when the backend has no page layout.
   */
  protected resolveMountedPageScrollRect(
    position: number
  ): MountedViewScrollRect | null {
    void position;
    return null;
  }

  /** Initializes PM plugin view objects after the concrete runtime is ready. */
  protected initializeMountedPluginViews(): void {
    if (this.destroyed) {
      return;
    }

    this.pluginViewLifecycle.initialize(this);
    this.mountedServices.initialize({
      editor: this.editor,
      view: this,
      input: this.getMountedServiceInput(),
      activateText: (target, options) => !this.destroyed && this.editable && this.activateMountedServiceText(target, options),
      suspendVisualAccessibility: () => suspendVisualAccessibility(this.getMountedServiceVisualRoots())
    });
  }

  /** @returns Optional input capability after the concrete mount is initialized. */
  protected getMountedServiceInput(): QuireTextContextHost | undefined { return undefined; }

  /** @returns Presentation roots whose accessible exposure is owned by the backend. */
  protected getMountedServiceVisualRoots(): readonly HTMLElement[] { return []; }

  /** @param target - Version-bound text request. @param options - Focus policy. @returns Whether this backend accepted it. */
  protected activateMountedServiceText(target: QuireMountedTextTarget, options?: QuireMountedTextActivationOptions): boolean {
    void [target, options];
    return false;
  }

  /** Whether the concrete renderer owns post-update completion at commit time. */
  protected completesMountedPostUpdate = false;
  /** Accepted post-update work, independent of the final render's schedule mode. */
  protected postUpdateGeneration = 0;
  private completedPostUpdateGeneration = 0;

  /** Completes plugin and scroll lifecycle work after a deferred concrete render. */
  protected completeDeferredMountedPostUpdate(): void {
    const generation = this.postUpdateGeneration;
    if (this.destroyed || generation === this.completedPostUpdateGeneration) return;
    // Consume before plugin hooks: reentrant updates belong to a later commit.
    this.completedPostUpdateGeneration = generation;
    this.refreshMountedGeometry(() => {
      this.pluginViewLifecycle.update(this);
      if (!this.destroyed && generation === this.postUpdateGeneration) this.scrolling.scrollToSelectionIfRequested();
    });
  }

  /** @param refresh - Commits geometry before notification; pure viewport refreshes need no PM update. */
  protected refreshMountedGeometry(refresh: () => void): void {
    const generation = this.postUpdateGeneration;
    refresh();
    for (const listener of this.geometryUpdateListeners) {
      if (this.destroyed || generation !== this.postUpdateGeneration) return;
      listener();
    }
  }

  /**
   * Runs a concrete view refresh and then updates PM plugin views.
   *
   * @param options - Shared editor state and update reason.
   */
  private refreshMountedView(options: QuireMountedEditorViewUpdateOptions): void {
    this.syncInputProxyEditableState();
    // Native offsets must observe acceptance before an asynchronous paint or another browser event.
    this.mountedServices.update(this.state);
    this.postUpdateGeneration += 1;
    this.updateMountedView(options);
    if (!this.completesMountedPostUpdate) {
      this.completeDeferredMountedPostUpdate();
    }
  }

  /** Synchronizes native textarea editability before mounted render scheduling. */
  private syncInputProxyEditableState(): void {
    const inputProxy = this.elements.inputProxy;

    if (inputProxy !== undefined) {
      syncMountedInputProxyEditableState(inputProxy, this.editable);
    }
  }

  /**
   * Reports whether any PM-style `editable` prop disables editing.
   *
   * @returns Whether direct or plugin props returned false for the current state.
   */
  private hasEditablePropDisabledEditing(): boolean {
    return (
      this.someProp("editable", (value) => {
        if (typeof value !== "function") {
          return false;
        }

        return (value as (state: PMEditorState) => boolean)(this.state) === false;
      }) === true
    );
  }

  /** Focuses the concrete editable target owned by a mode runtime. */
  protected abstract focusEditableTarget(): void;

  /**
   * Performs a mode-specific update after the base lifecycle guard passes.
   *
   * @param options - Shared editor state and update reason.
   */
  protected abstract updateMountedView(
    options: QuireMountedEditorViewUpdateOptions
  ): void;

  /** Performs mode-specific cleanup after the base lifecycle guard passes. */
  protected abstract destroyMountedView(): void;

  /**
   * Maps viewport coordinates to a document position.
   *
   * @param coords - Viewport coordinates in CSS pixels.
   * @returns Document position near the coordinates, or null when no position is available.
   */
  abstract posAtCoords(
    coords: QuireViewViewportCoords
  ): QuireViewPosAtCoordsResult | null;

  /**
   * Maps a document position to viewport coordinates.
   *
   * @param pos - Document position to map.
   * @param side - Side preference when the position sits between boxes.
   * @returns Viewport rectangle for the requested document position.
   */
  abstract coordsAtPos(pos: number, side?: number): QuireViewCoordsAtPosResult;

  /**
   * Resolves Table chrome when the mounted backend retains layout geometry.
   *
   * Non-retained backends return null until they provide an equivalent exact
   * geometry authority; product code must not synthesize table rectangles.
   *
   * @param tablePos - Absolute ProseMirror position immediately before the table.
   * @param activePosition - Canonical position used to choose the active occurrence.
   * @returns Viewport-projected Table chrome, or null when unsupported.
   */
  getTableChrome(
    tablePos: number,
    activePosition: number
  ): QuireMountedTableChromeModel | null {
    void tablePos;
    void activePosition;
    return null;
  }

  /**
   * Reads the retained pointer target that currently owns command routing.
   *
   * Backends with a mounted interaction lifecycle override this default. The
   * base never reconstructs target semantics from selection or DOM geometry.
   *
   * @returns Clone-safe target snapshot, or null without retained ownership.
   */
  getInteractionTargetSnapshot(): QuireMountedInteractionTargetSnapshot | null {
    return null;
  }

  /**
   * Subscribes to committed mounted geometry revisions.
   *
   * @param listener - Callback invoked after the concrete render commits.
   * @returns Release function for the subscription.
   */
  onGeometryUpdate(listener: () => void): () => void {
    if (this.destroyed) return () => {};
    this.geometryUpdateListeners.add(listener);
    return () => { this.geometryUpdateListeners.delete(listener); };
  }

  /**
   * Reports whether movement would leave the current textblock.
   *
   * @param direction - Movement direction to test.
   * @returns Whether the selection sits at the textblock boundary.
   */
  abstract endOfTextblock(direction: QuireViewTextblockDirection): boolean;
}

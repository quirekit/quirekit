import { TextSelection, type Node as ProseMirrorNode } from "@quirekit/pm";
import type { QuireBlockPointerLease, QuireMountedBlockFragment, QuireMountedTextRangeRect } from "@quirekit/core";
import type { QuireDocumentRange } from "@quirekit/renderer";
import { beginMountedBlockPointerLease, validateMountedBlockPointerLease } from "@quirekit/view/mounted-backend";
import { queryHtmlBlockFragments, queryHtmlBlockFragmentsInRect } from "./geometry/blocks";
import { createHtmlVisualNavigation } from "./measurement/navigation";
import {
  DecorationGroup,
  DecorationSet,
  type DecorationSource
} from "@quirekit/pm";
import type { QuireMountedInteractionTargetSnapshot } from "@quirekit/core";
import type {
  QuireHiddenTextViewMode
} from "@quirekit/view-engine";
import {
  BaseMountedEditorView,
  createMountedViewInteractionLifecycle,
  type MountedViewInteractionLifecycle,
  type MountedViewScrollRect,
  type QuireMountedEditorViewUpdateOptions,
  type QuireViewCoordsAtPosResult,
  type QuireViewPosAtCoordsResult,
  type QuireViewTextblockDirection,
  type QuireViewViewportCoords
} from "@quirekit/view/mounted-backend";
import { createHtmlClipboardOutputStrategy } from "./clipboard";
import { createMountedPointerSelectionRenderer } from "@quirekit/view/mounted-backend";
import { createHtmlMountedViewElements } from "./dom";
import { bindHtmlMountedNativeEditingGuards } from "./native-editing-guards";
import {
  createHtmlContinuousFlowPresentation,
  type HtmlContinuousFlowPresentation
} from "./presentation";
import { bindHtmlMountedPointerEvents } from "./pointer-events";
import { bindHtmlResizeEvents } from "./presentation/resize";
import type {
  HtmlMountedView,
  HtmlMountedViewElements,
  HtmlMountedViewOptions,
  HtmlMountedViewRuntimeOptions
} from "./types";

/** Runtime copy whose hidden-text mode is owned by the mounted view. */
type HtmlMountedMutableRuntime = Omit<
  HtmlMountedViewRuntimeOptions,
  "hiddenTextViewMode"
> & {
  hiddenTextViewMode?: QuireHiddenTextViewMode | undefined;
};

/** Mounted HTML editor view shell with retained DOM selection geometry. */
export class HtmlMountedEditorView
  extends BaseMountedEditorView<"html", HtmlMountedViewElements>
  implements HtmlMountedView
{
  private readonly runtime: HtmlMountedMutableRuntime;
  private readonly presentation: HtmlContinuousFlowPresentation;
  private readonly interactionLifecycle: MountedViewInteractionLifecycle;

  /**
   * Creates and mounts an HTML editor view shell.
   *
   * @param options - Editor, host element, identity, status, and runtime sizing.
   */
  constructor(options: HtmlMountedViewOptions) {
    super({
      editor: options.editor,
      id: options.id,
      mode: "html",
      status: options.status,
      elements: createHtmlMountedViewElements(options)
    });
    this.runtime = { ...options.runtime };
    this.presentation = createHtmlContinuousFlowPresentation({
      id: this.id,
      mountedView: this,
      editor: options.editor,
      elements: this.elements,
      ...(this.runtime === undefined ? {} : { runtime: this.runtime }),
      getSelectionGeometryContext: () =>
        this.interactionLifecycle.getSelectionGeometryContext(),
      focusDocumentInput: () =>
        this.interactionLifecycle.getInputBinding()?.focus(),
      hasFocus: () => this.hasFocus(),
      isDestroyed: () => this.isMountedViewDestroyed(),
      setDocumentFocused: (focused) => {
        this.setMountedFocusState(focused);
      },
      setViewTargets: (targets) => {
        this.interactionLifecycle.widgetEvents.setTargets(targets);
      },
      requestDeferredPostUpdate: () => {
        this.postUpdateGeneration += 1;
      },
      completeDeferredPostUpdate: () => {
        this.completeDeferredMountedPostUpdate();
      },
      resolveDecorationSource: () => this.resolveDecorationSource()
    });
    this.interactionLifecycle = createMountedViewInteractionLifecycle({
      navigation: createHtmlVisualNavigation(options.editor, this.presentation.measurementProvider),
      host: {
        id: this.id,
        kind: "html",
        surface: this.elements.contentSurface,
        metadata: {
          root: this.elements.root,
          overlaySurface: this.elements.overlaySurface
        }
      },
      eventHandlers: options.editor.extensionManager.viewEventHandlers,
      getWidgetContext: () => ({
        editor: options.editor,
        view: this,
        mode: this.mode,
        status: this.status
      }),
      status: this.status,
      editor: options.editor,
      inputProxy: this.elements.inputProxy,
      readEditable: () => this.editable,
      root: this.elements.root,
      overlayHost: this.elements.overlayHost,
      getInteractionSnapshot: () =>
        this.presentation.getRenderResult()?.interactionSnapshot,
      clipboardOutputStrategy: createHtmlClipboardOutputStrategy({
        ownerDocument: this.elements.root.ownerDocument
      }),
      render: (reason, imePreedit) => {
        this.presentation.render({
          editor: options.editor,
          reason,
          imePreedit
        });
      },
      onFocusChange: (focused) => {
        this.presentation.transitionFocus(
          focused
            ? this.elements.inputProxy
            : this.elements.root.ownerDocument.activeElement
        );
      }
    });

    this.setMountedWidgetEventRuntime(this.interactionLifecycle.widgetEvents);
    options.element.appendChild(this.elements.root);
    this.interactionLifecycle.addCleanup(bindHtmlMountedPointerEvents({
      mountedView: this,
      elements: this.elements,
      widgetEvents: this.interactionLifecycle.widgetEvents,
      measurementProvider: this.presentation.measurementProvider,
      runtime: this.runtime,
      getRenderState: () => this.presentation.getRenderState(),
      getInputBinding: () => this.interactionLifecycle.getInputBinding(),
      getInteractionTarget: () =>
        this.interactionLifecycle.getInteractionTarget(),
      focus: () => {
        this.focus();
      },
      stopEvent: (event) => this.presentation.stopEvent(event),
      renderSelection: createMountedPointerSelectionRenderer(
        () => this.presentation.flushPendingRender(),
        () => this.presentation.getRenderResult()?.layoutSnapshot.state === this.editor.state,
        () => this.presentation.render({ editor: this.editor, reason: "selection" })
      ),
      setInteractionTarget: (target) => {
        this.interactionLifecycle.setInteractionTarget(target);
      },
      setSelectionGeometryContext: (context) => {
        this.interactionLifecycle.setSelectionGeometryContext(context);
      },
      prepareHeaderFooterPointerSelection: (target, clickCount) =>
        this.interactionLifecycle.prepareHeaderFooterPointerSelection(
          target,
          clickCount
        ),
      onPointerHitTest: (hitTestResult) => {
        this.runtime?.onPointerHitTest?.({ view: this, hitTestResult });
      }
    }));
    this.interactionLifecycle.addCleanup(bindHtmlMountedNativeEditingGuards({
      elements: this.elements,
      stopEvent: (event) => this.presentation.stopEvent(event),
      focus: () => {
        this.focus();
      }
    }));
    this.interactionLifecycle.addCleanup(bindHtmlResizeEvents(this.elements.root, this.elements.contentSurface,
      passiveResize => this.presentation.render({ editor: this.editor, reason: "resize", passiveResize })));
    this.presentation.render({
      editor: options.editor,
      reason: "initial"
    });
    this.initializeMountedPluginViews();
  }

  /** Focuses the HTML view input proxy. */
  protected focusEditableTarget(): void {
    this.presentation.restoreDocumentFocus();
  }

  /**
   * Maps viewport coordinates to a document position.
   *
   * @param coords - Viewport coordinates in CSS pixels.
   * @returns Document position near the coordinates, or null when unavailable.
   */
  posAtCoords(coords: QuireViewViewportCoords): QuireViewPosAtCoordsResult | null {
    const result = this.presentation.measurementProvider.posAtClientPoint(
      coords.left,
      coords.top
    );
    return result === null ? null : { pos: result.pos, inside: result.inside };
  }

  /**
   * Maps a document position to viewport coordinates.
   *
   * @param pos - Document position to map.
   * @param side - Side preference when the position sits between boxes.
   * @returns Viewport rectangle for the requested document position.
   */
  coordsAtPos(pos: number, side = 1): QuireViewCoordsAtPosResult {
    const rect = this.presentation.measurementProvider.coordsAtPos(pos, side);
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }

  /**
   * Measures passive line bands of a range, such as a collaborator's selection.
   *
   * @param range - Half-open range in the current document.
   * @param sourceDocument - Exact document the range was resolved against.
   * @returns Client-space line bands, or null when the document is stale.
   */
  getTextRangeRects(range: QuireDocumentRange, sourceDocument: ProseMirrorNode): readonly QuireMountedTextRangeRect[] | null {
    if (sourceDocument !== this.state.doc) return null;
    return this.presentation.measurementProvider.selectionRects(range)
      .map(({ left, top, right, bottom }) => ({ x: left, y: top, width: right - left, height: bottom - top }));
  }

  /**
   * Reports whether movement would leave the current textblock.
   *
   * @param direction - Movement direction to test.
   * @returns Whether the selection sits at the textblock boundary.
   */
  endOfTextblock(direction: QuireViewTextblockDirection): boolean {
    const selection = this.state.selection;
    if (!selection.empty || !(selection instanceof TextSelection)) return false;
    if (direction === "up" || direction === "down") {
      const caret = this.presentation.measurementProvider.coordsAtPos(selection.head);
      const edge = this.presentation.measurementProvider.coordsAtPos(
        direction === "up" ? selection.$head.start() : selection.$head.end(),
        direction === "up" ? 1 : -1
      );
      return caret.top < edge.bottom && caret.bottom > edge.top;
    }
    return direction === "left" || direction === "backward"
      ? selection.$head.parentOffset === 0
      : selection.$head.parentOffset === selection.$head.parent.content.size;
  }

  /** @inheritdoc */
  override dispatchEvent(event: Event): boolean {
    return this.presentation.stopEvent(event) || super.dispatchEvent(event);
  }

  /**
   * Finds the rendered DOM position for a document position in HTML mode.
   *
   * @param pos - Document position to map.
   * @param side - Side preference for boundary positions.
   * @returns DOM node and offset for the requested position.
   */
  domAtPos(pos: number, side = 0): { node: Node; offset: number } {
    const point = this.presentation.measurementProvider.domAtPos(pos, side);
    return { node: point.node, offset: point.offset };
  }

  /**
   * Finds the rendered DOM node for the document node after a position.
   *
   * @param pos - Document position before the node.
   * @returns Rendered DOM node, or null when unavailable.
   */
  nodeDOM(pos: number): Node | null {
    return this.presentation.measurementProvider.nodeDOM(pos);
  }

  /**
   * Maps a DOM position inside the HTML content surface back to a document position.
   *
   * @param node - DOM node inside the HTML content surface.
   * @param offset - DOM offset inside the node.
   * @param bias - Side bias for ambiguous boundary positions.
   * @returns Document position represented by the DOM position.
   */
  posAtDOM(node: Node, offset: number, bias = -1): number {
    return this.presentation.measurementProvider.posAtDOM(node, offset, bias).pos;
  }

  /**
   * Renders the latest shared editor state into this mounted HTML view.
   *
   * @param options - Shared editor state and update reason.
   */
  protected updateMountedView(options: QuireMountedEditorViewUpdateOptions): void {
    validateMountedBlockPointerLease(this);
    this.presentation.render(options);
  }

  /** @param clientY - Pointer height in client CSS pixels. @returns Nearby retained continuous-flow blocks. */
  queryBlockFragments(clientY: number): readonly QuireMountedBlockFragment[] {
    return queryHtmlBlockFragments(this.presentation.getRenderResult(), this.elements.contentSurface, clientY);
  }

  /** @param rect - Client CSS query rectangle. @returns Intersecting retained block occurrences. */
  queryBlockFragmentsInRect(rect: QuireMountedBlockFragment["rect"]): readonly QuireMountedBlockFragment[] {
    return queryHtmlBlockFragmentsInRect(this.presentation.getRenderResult(), this.elements.contentSurface, rect);
  }

  /** @param event - Primary pointer press. @param lease - Semantic drag callbacks. @returns Cancellation, or refusal when another input owns the pointer. */
  beginBlockDrag(event: PointerEvent, lease: QuireBlockPointerLease): (() => void) | null {
    return beginMountedBlockPointerLease(this, event, lease);
  }

  /** @inheritdoc */
  setHiddenTextViewMode(mode: QuireHiddenTextViewMode): void {
    if (this.runtime.hiddenTextViewMode === mode) {
      return;
    }
    this.runtime.hiddenTextViewMode = mode;
    this.elements.root.dataset.qkHiddenTextView = mode;
    this.presentation.render({ editor: this.editor, reason: "mode-change" });
  }

  /** @inheritdoc */
  get hiddenTextViewMode(): QuireHiddenTextViewMode {
    return this.runtime.hiddenTextViewMode ?? "normal";
  }

  /** @inheritdoc */
  protected override completesMountedPostUpdate = true;

  /**
   * Resolves the retained selection rectangle used by default PM-style scrolling.
   *
   * @returns Client-space selection rectangle, or null before the first render.
   */
  protected resolveMountedSelectionScrollRect(): MountedViewScrollRect | null {
    if (!this.presentation.getRenderResult()) return null;
    const rect = this.presentation.measurementProvider.coordsAtPos(this.state.selection.head, 1);
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }

  /**
   * Resolves the retained position-anchor rectangle used by PM-style scrolling.
   *
   * @param position - Document position that should become visible.
   * @returns Client-space position-anchor rectangle, or null before geometry exists.
   */
  protected resolveMountedPositionScrollRect(
    position: number
  ): MountedViewScrollRect | null {
    const rect = this.presentation.measurementProvider.coordsAtPos(position, 1);
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }

  /**
   * Reads the canonical pointer target retained by the HTML interaction lifecycle.
   *
   * @returns Clone-safe semantic target facts, or null without retained ownership.
   */
  override getInteractionTargetSnapshot(): QuireMountedInteractionTargetSnapshot | null {
    return this.interactionLifecycle.getInteractionTargetSnapshot();
  }

  /** Tears down resources owned by this mounted HTML view. */
  protected destroyMountedView(): void {
    this.presentation.destroy();
    this.interactionLifecycle.destroy();
    this.elements.root.remove();
  }

  /**
   * Collects every direct and plugin PM decoration source in view order.
   *
   * @returns One node-localizable source for retained descriptor creation.
   */
  private resolveDecorationSource(): DecorationSource {
    const sets: DecorationSet[] = [];
    this.someProp("decorations", (provider) => {
      if (typeof provider !== "function") {
        return false;
      }
      provider(this.state)?.forEachSet((set: DecorationSet) => {
        sets.push(set);
      });
      return false;
    });
    return DecorationGroup.from(sets);
  }
}

/**
 * Creates a mounted HTML editor view shell.
 *
 * @param options - Editor, host element, identity, status, and runtime sizing.
 * @returns Mounted HTML editor view shell.
 */
export function createHtmlMountedView(options: HtmlMountedViewOptions): HtmlMountedView {
  return new HtmlMountedEditorView(options);
}

export { createHtmlMountedViewElements };

import {
  deriveQuireLayoutDirtyRangeFromTransactions,
  deriveQuireViewUpdatePatch,
  resolveDisplayListStyles, resolveQuireDocumentProfile,
  type QuireRetainedLayoutSnapshot
} from "@quirekit/view-engine";
import { measureHtmlSelectionRects } from "../measurement/selection";
import { syncSvgDisplayListToSvg } from "@quirekit/renderer";
import { syncQuireDomOverlays } from "@quirekit/view/mounted-backend";
import {
  createMountedViewUpdateRevisionClock,
  resolveMountedViewUpdateScheduleMode,
  type MountedViewUpdateRevisionClock
} from "@quirekit/view/mounted-backend";
import { createHtmlFlowRenderResult, type HtmlFlowRenderResult } from "../geometry";
import { HtmlFlowGeometryRuntime } from "../geometry/retained";
import { syncHtmlMountedRootAttributes } from "../attributes";
import {
  createHtmlDocumentCompositionRuntime,
  createHtmlMutationBoundary,
  createHtmlRetainedDocumentView,
  syncHtmlRetainedDocumentSurfaceStyle,
  type HtmlDocumentCompositionRuntime,
  type HtmlMutationBoundary,
  type HtmlRetainedDocumentView
} from "../document";
import { createHtmlFocusRuntime, type HtmlFocusRuntime } from "../focus";
import { syncHtmlMountedInputProxy } from "../input-proxy";
import {
  createHtmlDomMeasurementProvider,
  type HtmlDomMeasurementProvider
} from "../measurement";
import type { HtmlReconcileTrace } from "../reconcile";
import {
  composeHtmlScheduledTransactions,
  createHtmlRenderScheduler,
  type HtmlRenderDiagnostics,
  type HtmlRenderPhaseContext,
  type HtmlRenderScheduler,
  type HtmlScheduledUpdate
} from "../scheduling";
import {
  createHtmlAuxiliaryOverlayDisplayList,
  createHtmlSelectionRuntime,
  type HtmlSelectionRuntime
} from "../selection";
import {
  measureHtmlMountedSurfaceState,
  syncHtmlMountedSurfaceGeometry,
  type HtmlMountedRenderSurfaceState
} from "../surface";
import type {
  CreateHtmlContinuousFlowPresentationOptions,
  HtmlContinuousFlowDomGeometry,
  HtmlContinuousFlowRenderOptions,
  HtmlContinuousFlowRenderState,
  HtmlPresentationScheduledPayload,
  HtmlPresentationRenderProducts,
  HtmlPresentationContentWriteProducts
} from "./types";

/**
 * Owns the retained continuous-flow HTML surface and its ordered write/read/write pipeline.
 */
export class HtmlContinuousFlowPresentation {
  /** Retained document descriptor tree and mounted DOM root. */
  readonly documentView: HtmlRetainedDocumentView;
  /** Browser geometry authority for the retained document tree. */
  readonly measurementProvider: HtmlDomMeasurementProvider;

  private readonly options: CreateHtmlContinuousFlowPresentationOptions;
  private readonly documentRoot: HTMLElement;
  private readonly compositionRuntime: HtmlDocumentCompositionRuntime;
  private readonly mutationBoundary: HtmlMutationBoundary;
  private readonly scheduler: HtmlRenderScheduler;
  private readonly selectionRuntime: HtmlSelectionRuntime;
  private readonly focusRuntime: HtmlFocusRuntime;
  private readonly flowGeometry = new HtmlFlowGeometryRuntime();
  private readonly updateRevisionClock: MountedViewUpdateRevisionClock =
    createMountedViewUpdateRevisionClock();
  private currentRenderResult: HtmlFlowRenderResult | undefined;
  private currentSurfaceState: HtmlMountedRenderSurfaceState | undefined;
  private currentImePreedit: HtmlContinuousFlowRenderOptions["imePreedit"];
  private currentDomGeometry: HtmlContinuousFlowDomGeometry | undefined;
  private pendingRenderProducts: HtmlPresentationRenderProducts | undefined;
  private latestReconcileTrace: HtmlReconcileTrace | undefined;
  private latestCompositionWrites = 0;
  private destroyed = false;

  /**
   * Creates the retained resources for one mounted HTML backend.
   *
   * @param options - Mounted facade, DOM surfaces, editor, and lifecycle callbacks.
   */
  constructor(options: CreateHtmlContinuousFlowPresentationOptions) {
    this.options = options;
    this.documentView = createHtmlRetainedDocumentView({
      id: `${options.id}:document`,
      documentNode: options.editor.state.doc,
      ownerDocument: options.elements.root.ownerDocument,
      source: { sourceId: `${options.id}:document` },
      nodeViewEnvironment: {
        view: options.mountedView,
        nodeViews: options.editor.extensionManager.nodeViews,
        markViews: options.editor.extensionManager.markViews,
        getDecorations: options.resolveDecorationSource
      }
    });
    const retainedRoot = this.documentView.root.mount?.dom;
    if (!retainedRoot) {
      throw new RangeError("Retained HTML document root requires a mounted DOM product.");
    }
    this.documentRoot = retainedRoot as HTMLElement;
    syncHtmlRetainedDocumentSurfaceStyle(
      this.documentRoot,
      options.runtime,
      options.editor.state.doc
    );
    options.elements.contentSurface.appendChild(this.documentRoot);
    this.selectionRuntime = createHtmlSelectionRuntime({
      ownerDocument: options.elements.root.ownerDocument,
      host: options.elements.overlayHost,
      documentRoot: this.documentRoot
    });
    this.focusRuntime = createHtmlFocusRuntime({
      ownerDocument: options.elements.root.ownerDocument,
      documentRoot: this.documentRoot,
      documentSurface: options.elements.contentSurface,
      inputProxy: options.elements.inputProxy,
      focusDocumentInput: options.focusDocumentInput,
      isNodeViewControl: (target) =>
        this.documentView.ownerAtDOM(target)?.kind === "node-view",
      onOwnerChange: (owner) => {
        const documentFocused = owner === "document";
        options.setDocumentFocused(documentFocused);
        if (!options.isDestroyed()) {
          options.runtime?.onFocusChange?.(documentFocused);
          this.syncSelectionPresentation();
        }
      }
    });
    this.measurementProvider = createHtmlDomMeasurementProvider({
      documentView: this.documentView,
      ownerDocument: options.elements.root.ownerDocument,
      surface: options.elements.contentSurface,
      rootId: `${options.id}:document-root`,
      regionId: `${options.id}:document-body`,
      projectDomPoint: (point) => this.compositionRuntime.projectDomPoint(point)
    });
    this.compositionRuntime = createHtmlDocumentCompositionRuntime({
      documentView: this.documentView,
      resolveDomPoint: (pos, side) => this.measurementProvider.domAtPos(pos, side),
      ownerDocument: options.elements.root.ownerDocument,
      rootId: `${options.id}:document-root`,
      regionId: `${options.id}:document-body`
    });
    this.mutationBoundary = createHtmlMutationBoundary({
      contentSurface: options.elements.contentSurface,
      root: this.documentView.root
    });
    this.scheduler = createHtmlRenderScheduler({
      runContentWrite: (update, context) =>
        this.runContentWrite(update, context),
      runGeometryRead: (update, content, context) =>
        this.runGeometryRead(update, content, context),
      runOverlayWrite: (update, _content, products) => {
        this.applyOverlayWrite(products);
        if (update.revision?.stateVersion === this.updateRevisionClock.current().stateVersion) {
          this.options.completeDeferredPostUpdate();
        }
      },
      readCurrentRevision: () => this.updateRevisionClock.current(),
      onRender: (diagnostics) => {
        this.emitRender(diagnostics);
      }
    });
  }

  /**
   * Requests one retained HTML update through the canonical scheduler.
   *
   * @param renderOptions - Current editor state, reason, preedit, and transactions.
   */
  render(renderOptions: HtmlContinuousFlowRenderOptions): void {
    if (this.destroyed || this.options.isDestroyed()) {
      return;
    }
    if (renderOptions.reason === "composition") {
      if (renderOptions.imePreedit === undefined && this.currentImePreedit === undefined) {
        return;
      }
      this.currentImePreedit = renderOptions.imePreedit;
    }
    // A ResizeObserver delivery must not synchronously resize its own surface.
    // Coalesce passive notifications through the same frame queue as input.
    const mode = renderOptions.reason === "resize" && renderOptions.passiveResize ? "frame" : resolveMountedViewUpdateScheduleMode({
      reason: renderOptions.reason,
      focused: this.options.hasFocus()
    });
    const reuseContentRender = this.canReuseContent(renderOptions);
    const revision = this.updateRevisionClock.advance(!reuseContentRender);
    if (mode === "frame") this.options.requestDeferredPostUpdate();
    this.scheduler.request({
      reason: renderOptions.reason,
      stateVersions: [revision.stateVersion],
      revision,
      ...(renderOptions.transactions === undefined
        ? {}
        : { transactions: renderOptions.transactions }),
      selectionOnly: renderOptions.reason === "composition" ? false : reuseContentRender,
      payload: {
        options: renderOptions,
        reuseContentRender
      } satisfies HtmlPresentationScheduledPayload
    }, { mode });
  }

  /** Flushes transaction-owned presentation work already waiting for a frame. */
  flushPendingRender(): void {
    this.scheduler.flush();
  }

  /** @returns Latest committed render state, or null before first render. */
  getRenderState(): HtmlContinuousFlowRenderState | null {
    return this.currentRenderResult && this.currentSurfaceState
      ? {
          renderResult: this.currentRenderResult,
          surfaceState: this.currentSurfaceState
        }
      : null;
  }

  /** @returns Latest renderer-neutral render result, or undefined before first render. */
  getRenderResult(): HtmlFlowRenderResult | undefined {
    return this.currentRenderResult;
  }

  /** Restores focus to the canonical document input proxy. */
  restoreDocumentFocus(): void {
    this.focusRuntime.restoreDocumentFocus();
  }

  /**
   * Applies one browser focus target to continuous-flow focus ownership.
   *
   * @param target - Focused node, or null when focus left the document.
   */
  transitionFocus(target: Node | null): void {
    this.focusRuntime.transitionTo(target);
  }

  /**
   * Lets retained NodeViews claim events before mounted defaults.
   *
   * @param event - Browser event to classify.
   * @returns Whether a retained owner stopped the event.
   */
  stopEvent(event: Event): boolean {
    return this.documentView.stopEvent(event);
  }

  /** Destroys scheduler and retained browser resources exactly once. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.scheduler.destroy();
    this.flowGeometry.destroy();
    this.compositionRuntime.destroy();
    this.mutationBoundary.destroy();
    this.focusRuntime.destroy();
    this.selectionRuntime.destroy();
    this.documentView.destroy();
  }

  /**
   * Reports whether retained content can survive a transient update.
   *
   * @param renderOptions - Exact current update and applied transactions.
   * @param surfaceState - Current measured surface, or the prior surface during scheduling.
   * @returns Whether the update can rebuild only transient presentation.
   */
  private canReuseContent(
    renderOptions: HtmlContinuousFlowRenderOptions,
    surfaceState = this.currentSurfaceState
  ): boolean {
    if (!this.currentRenderResult || !surfaceState) return false;
    if (renderOptions.reason === "composition") return true;
    if (renderOptions.reason !== "selection" && renderOptions.reason !== "transaction"
      && !(renderOptions.reason === "resize" && renderOptions.passiveResize)) return false;
    if (this.currentRenderResult.layoutSnapshot.state.doc !== this.options.editor.state.doc) return false;
    // Unknown decoration dependencies still enter retained reconciliation. This
    // decision concerns DOM writes only; it never consults a layout provider.
    let hasDecorations = false;
    this.options.mountedView.someProp("decorations", () => { hasDecorations = true; return true; });
    return !hasDecorations;
  }

  /**
   * Performs the retained content-write phase and derives shared invalidation.
   *
   * @param update - Coalesced scheduled update.
   * @param context - Content-write phase authority.
   * @returns Invalidation facts consumed by geometry and render compilation.
   */
  private runContentWrite(
    update: HtmlScheduledUpdate,
    context: HtmlRenderPhaseContext
  ): HtmlPresentationContentWriteProducts {
    const payload = requirePresentationPayload(update);
    const invalidation = this.createContentInvalidation(update);
    this.mutationBoundary.beginOwnedWrites();
    syncHtmlMountedRootAttributes({
      view: this.options.mountedView,
      root: this.options.elements.root
    });
    this.latestCompositionWrites = 0;
    const compositionPresentation = this.resolveCompositionPresentation();

    if (update.transactions && update.transactions.length > 0) {
      const composed = composeHtmlScheduledTransactions(update.transactions);
      const mappedPreedit = this.compositionRuntime.prepareDocumentUpdate(
        composed.mapping,
        this.currentImePreedit !== undefined
      );
      const result = this.documentView.update({
        documentNode: composed.documentNode,
        mapping: composed.mapping,
        changedRanges: composed.changedRanges
      });
      if (syncHtmlRetainedDocumentSurfaceStyle(
        this.documentRoot,
        this.options.runtime,
        composed.documentNode
      )) {
        context.recordContentWrite();
      }
      this.currentImePreedit = mappedPreedit;
      const composition = this.compositionRuntime.sync(
        mappedPreedit,
        compositionPresentation
      );
      this.latestCompositionWrites = composition.writes;
      this.latestReconcileTrace = result.trace;
      context.recordReconciliation();
      const writes = result.trace.textWrites.length +
        result.trace.attributeWrites.length + result.trace.structureWrites.length;
      for (let index = 0; index < writes + composition.writes; index += 1) {
        context.recordContentWrite();
      }
      this.mutationBoundary.drainOwnedWrites({ ownershipChanged: result.ownershipChanged });
      return invalidation;
    }

    if (this.documentView.root.node !== payload.options.editor.state.doc) {
      throw new RangeError(
        "Retained HTML document changes require their applied transactions."
      );
    }
    this.latestReconcileTrace = undefined;
    const composition = this.compositionRuntime.sync(
      this.currentImePreedit,
      compositionPresentation
    );
    this.latestCompositionWrites = composition.writes;
    for (let index = 0; index < composition.writes; index += 1) {
      context.recordContentWrite();
    }
    this.mutationBoundary.drainOwnedWrites({ ownershipChanged: false });
    return invalidation;
  }

  /**
   * Derives one invalidation envelope for the complete scheduled update.
   *
   * @param update - Coalesced scheduled update.
   * @returns Dirty range, typed patch, and current retained-owner projection.
   */
  private createContentInvalidation(
    update: HtmlScheduledUpdate
  ): HtmlPresentationContentWriteProducts {
    const layoutDirtyRange = deriveQuireLayoutDirtyRangeFromTransactions(
      update.transactions, resolveQuireDocumentProfile(this.options.editor.extensionManager)
    );
    const updatePatch = deriveQuireViewUpdatePatch({
      reason: update.reason,
      transactions: update.transactions,
      layoutDirtyRange
    });
    return { layoutDirtyRange, updatePatch };
  }

  /**
   * Performs all browser geometry reads after retained content writes settle.
   *
   * @param update - Coalesced scheduled update.
   * @param content - Content invalidation products, when content was written.
   * @param context - Geometry-read phase authority.
   * @returns Products committed by the final overlay-write phase.
   */
  private runGeometryRead(
    update: HtmlScheduledUpdate,
    content: HtmlPresentationContentWriteProducts | undefined,
    context: HtmlRenderPhaseContext
  ): HtmlPresentationRenderProducts {
    const payload = requirePresentationPayload(update);
    this.measurementProvider.invalidate();
    this.measurementProvider.resetRangeReadCount();
    if (update.selectionOnly) {
      this.latestReconcileTrace = undefined;
      this.latestCompositionWrites = 0;
    }
    const surfaceState = context.readGeometry(() =>
      measureHtmlMountedSurfaceState({
        contentSurface: this.options.elements.contentSurface,
        documentRoot: this.documentRoot,
        overlaySurface: this.options.elements.overlaySurface,
        runtime: this.options.runtime
      })
    );
    const layoutDirtyRange = content?.layoutDirtyRange ??
      deriveQuireLayoutDirtyRangeFromTransactions(update.transactions, resolveQuireDocumentProfile(this.options.editor.extensionManager));
    const updatePatch = content?.updatePatch ?? deriveQuireViewUpdatePatch({
      reason: update.reason,
      transactions: update.transactions,
      layoutDirtyRange
    });
    // Selection changes consume DOM measurements directly. Only content or
    // viewport changes rebuild the retained block/source geometry; no Engine
    // layout, shaping, pagination, or display compilation is involved.
    const trace = this.latestReconcileTrace;
    const contentChanged = this.latestCompositionWrites > 0 || !!trace &&
      (trace.textWrites.length + trace.attributeWrites.length + trace.structureWrites.length > 0);
    const reuseContentRender = !contentChanged && !!this.currentRenderResult &&
      this.currentRenderResult.layoutSnapshot.state.doc === this.options.editor.state.doc &&
      (update.reason === "selection" || update.reason === "transaction"
        || update.reason === "resize" && payload.options.passiveResize) &&
      this.currentSurfaceState?.displaySize.width === surfaceState.displaySize.width &&
      this.currentSurfaceState?.displaySize.height === surfaceState.displaySize.height;
    // Publish current structure facts before selection projection, including
    // when document replacement and select-all share this presentation frame.
    const geometry = context.readGeometry(() => this.flowGeometry.measure({
      editor: this.options.editor, documentView: this.documentView,
      surface: this.options.elements.contentSurface, surfaceState
    }, { reason: update.reason, trace, compositionWrites: this.latestCompositionWrites },
    this.currentRenderResult?.layoutSnapshot, reuseContentRender));
    const snapshot = geometry.snapshot;
    this.measurementProvider.updateBlockGeometry(snapshot.root, snapshot.state.doc, geometry.changedBlocks);
    const domGeometry = context.readGeometry(() => this.measureDomGeometry(snapshot));
    const renderResult = createHtmlFlowRenderResult({ snapshot, surfaceState, domGeometry, updatePatch });
    return {
      surfaceState,
      renderResult,
      strategy: this.flowGeometry.diagnostics.mode === "reuse" ? "selection-update" : "full",
      reason: payload.options.reason,
      domGeometry
    };
  }

  /**
   * Measures selection against the same semantic document that owns block geometry.
   * @param snapshot - Current document's continuous geometry and structure facts.
   * @returns One coherent selection, caret, mirror, and input-anchor geometry batch.
   */
  private measureDomGeometry(snapshot: QuireRetainedLayoutSnapshot): HtmlContinuousFlowDomGeometry {
    const selection = snapshot.state.pm.selection;
    const compositionAnchor = this.compositionRuntime.inputAnchor();
    const inputAnchor = compositionAnchor ??
      this.measurementProvider.inputAnchor(selection.head, 1);
    const mirrorPoint = this.currentImePreedit === undefined
      ? undefined
      : this.measurementProvider.domAtPos(selection.from, 1);
    return {
      surfaceClientRect: this.options.elements.contentSurface.getBoundingClientRect(),
      inputAnchor,
      ...(selection.empty ? { caret: inputAnchor } : {}),
      selectionRects: measureHtmlSelectionRects(selection, this.measurementProvider, snapshot.selectionStructureIndex),
      mirror: {
        anchor: mirrorPoint ?? this.measurementProvider.domAtPos(selection.anchor, 1),
        head: mirrorPoint ?? this.measurementProvider.domAtPos(selection.head, -1)
      },
      rangeReads: this.measurementProvider.getRangeReadCount() +
        (compositionAnchor === undefined ? 0 : 1)
    };
  }

  /**
   * Commits measured geometry and every transient presentation surface.
   *
   * @param products - Geometry and render products built by the read phase.
   */
  private applyOverlayWrite(products: HtmlPresentationRenderProducts): void {
    this.mutationBoundary.beginOwnedWrites();
    syncHtmlMountedSurfaceGeometry({
      contentSurface: this.options.elements.contentSurface,
      documentRoot: this.documentRoot,
      overlaySurface: this.options.elements.overlaySurface,
      runtime: this.options.runtime
    }, products.surfaceState);
    this.mutationBoundary.drainOwnedWrites({ ownershipChanged: false });
    this.flowGeometry.acceptSurfaceSize(this.options.elements.contentSurface);
    this.currentSurfaceState = products.surfaceState;
    this.currentRenderResult = products.renderResult;
    this.currentDomGeometry = products.domGeometry;
    this.options.setViewTargets(products.renderResult.viewTargets);
    this.repaintAuxiliaryOverlay();
    syncQuireDomOverlays({
      host: this.options.elements.overlayHost,
      overlays: products.renderResult.domOverlays
    });
    syncHtmlMountedInputProxy({
      inputProxy: this.options.elements.inputProxy,
      anchor: products.domGeometry.inputAnchor,
      runtime: this.options.runtime,
      ...(this.currentImePreedit === undefined
        ? {}
        : { imePreedit: this.currentImePreedit })
    });
    this.syncSelectionPresentation();
    this.pendingRenderProducts = products;
  }

  /**
   * Emits one completed render after the scheduler records all phases.
   *
   * @param diagnostics - Completed scheduler diagnostics.
   */
  private emitRender(diagnostics: HtmlRenderDiagnostics): void {
    const products = this.pendingRenderProducts;
    if (!products) {
      return;
    }
    this.pendingRenderProducts = undefined;
    const trace = this.latestReconcileTrace;
    const { rootReplacements, ...mutations } = this.mutationBoundary.getDiagnostics();
    this.options.runtime?.onRender?.({
      view: this.options.mountedView,
      renderResult: products.renderResult,
      strategy: products.strategy,
      reason: products.reason,
      viewportRect: products.surfaceState.viewportRect,
      displaySize: products.surfaceState.displaySize,
      phases: diagnostics.phases,
      diagnostics: {
        flowGeometryRebuilt: products.strategy === "full",
        geometry: this.flowGeometry.diagnostics,
        schedulerEvidence: "available",
        scheduler: diagnostics.scheduler,
        stateVersions: diagnostics.stateVersions,
        reconciliationFrames: diagnostics.reconciliationFrames,
        descriptorVisits: trace?.descriptorVisits ?? 0,
        nodeViewUpdateAttempts: trace?.nodeViewUpdateAttempts ?? 0,
        contentWrites: {
          text: trace?.textWrites.length ?? 0,
          attributes: trace?.attributeWrites.length ?? 0,
          structure: trace?.structureWrites.length ?? 0,
          composition: this.latestCompositionWrites
        },
        compositionGaps: this.compositionRuntime.getDiagnostics().gaps,
        rangeReads: products.domGeometry.rangeReads,
        forcedLayoutRisks: diagnostics.forcedLayoutRisks,
        rootReplacements: (trace?.rootReplacements ?? 0) + rootReplacements,
        mutations
      }
    });
  }

  /** Synchronizes custom selection, caret, and transparent native mirror. */
  private syncSelectionPresentation(): void {
    if (!this.currentDomGeometry) {
      return;
    }
    const styles = resolveDisplayListStyles(
      this.options.runtime?.displayListStyles,
      this.options.runtime?.surfaceConfig
    );
    this.selectionRuntime.sync({
      focusOwner: this.focusRuntime.owner,
      editable: this.options.mountedView.editable,
      surfaceClientRect: this.currentDomGeometry.surfaceClientRect,
      ...(this.currentDomGeometry.caret === undefined
        ? {}
        : { caret: this.currentDomGeometry.caret }),
      selectionRects: this.currentDomGeometry.selectionRects,
      mirror: this.currentDomGeometry.mirror,
      selectionFillStyle: styles.selectionFillStyle,
      caretFillStyle: styles.caretFillStyle
    });
  }

  /** @returns Semantic IME styles for the transient in-flow descriptor. */
  private resolveCompositionPresentation(): import("../descriptors").HtmlCompositionPresentation {
    const styles = resolveDisplayListStyles(
      this.options.runtime?.displayListStyles,
      this.options.runtime?.surfaceConfig
    );
    return {
      background: styles.imePreeditBackground,
      backgroundFillStyle: styles.imePreeditBackgroundFillStyle,
      underline: styles.imePreeditUnderline
    };
  }

  /** Repaints non-selection auxiliary commands into the SVG overlay surface. */
  private repaintAuxiliaryOverlay(): void {
    if (!this.currentRenderResult || !this.currentSurfaceState) {
      return;
    }
    syncSvgDisplayListToSvg({
      host: this.options.elements.overlaySurface,
      displayList: createHtmlAuxiliaryOverlayDisplayList(
        this.currentRenderResult.overlayDisplayList,
        this.currentSurfaceState.surfaceBounds
      )
    });
  }
}

/**
 * Creates one retained continuous-flow HTML presentation resource.
 *
 * @param options - Mounted facade, DOM surfaces, editor, and lifecycle callbacks.
 * @returns Owned HTML presentation resource.
 */
export function createHtmlContinuousFlowPresentation(
  options: CreateHtmlContinuousFlowPresentationOptions
): HtmlContinuousFlowPresentation {
  return new HtmlContinuousFlowPresentation(options);
}

/**
 * Narrows scheduler-owned opaque payload to presentation update facts.
 *
 * @param update - Scheduled update carrying presentation-owned data.
 * @returns Valid presentation payload.
 */
function requirePresentationPayload(
  update: HtmlScheduledUpdate
): HtmlPresentationScheduledPayload {
  if (!update.payload || typeof update.payload !== "object") {
    throw new TypeError("Mounted HTML scheduler update requires an internal payload.");
  }
  return update.payload as HtmlPresentationScheduledPayload;
}

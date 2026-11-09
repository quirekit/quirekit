import type {
  QuireMountedInteractionTargetSnapshot,
  QuireMountedObjectAnchorOccurrence,
  QuireMountedObjectAnchorResolution
} from "@quirekit/core";
import type {
  EditorUIAnchorRequest,
  EditorUIClientAnchorResolution
} from "@quirekit/editor-ui";
import type {
  QuireViewCoordsAtPosResult,
  QuireViewPosAtCoordsResult,
  QuireViewTextblockDirection,
  QuireViewViewportCoords
} from "../geometry";
import { resolveQuireDocumentProfile } from "@quirekit/view-engine";
import { registerMountedPresentationTarget } from "../../../mounted-services/presentation-overlay";
import { BaseMountedEditorView } from "../base-view";
import type { QuireMountedTextActivationOptions, QuireMountedTextTarget } from "../../../mounted-services/types";
import type { QuireTextContextHost } from "../../../input/text-context/types";
import type { MountedViewScrollRect } from "../scroll";
import type { QuireMountedEditorViewUpdateOptions } from "../types";
import { createMountedPaginatedRuntime } from "./runtime";
import type {
  InitializeMountedPaginatedEditorViewOptions,
  MountedPaginatedEditorViewElements,
  MountedPaginatedRuntime,
  MountedPaginatedRuntimeRequest
} from "./types";
import type { MountedDrawingCreationOptions } from "../drawing-interaction";
import type { QuireMountedTableChromeModel } from "../table-chrome";
import { resolveMountedObjectAnchorOccurrence } from "./object-anchor-occurrence";
import { beginMountedBlockPointerLease, validateMountedBlockPointerLease } from "../block-interaction";
import type { QuireBlockPointerLease, QuireMountedBlockFragment } from "@quirekit/core";

/** Mounted modes whose document presentation is realized as paginated pages. */
type MountedPaginatedViewMode = "canvas" | "svg";

/**
 * Shared PM-facing lifecycle for Canvas and SVG paginated mounted views.
 *
 * Backends initialize the canonical runtime after their own measurement and
 * presentation fields exist. The base then owns only renderer-neutral mounted
 * behavior; page realization and painting remain backend responsibilities.
 */
export abstract class MountedPaginatedEditorView<
  Mode extends MountedPaginatedViewMode,
  Elements extends MountedPaginatedEditorViewElements
> extends BaseMountedEditorView<Mode, Elements> {
  private mountedRuntimeValue: MountedPaginatedRuntime | undefined;
  /** Whether an overlay change still awaits a full document render. */
  private presentationOverlayPending = false;

  /** @inheritdoc */
  protected getMountedServiceInput(): QuireTextContextHost | undefined {
    const binding = this.mountedRuntime.interaction.getInputBinding();
    return binding?.attachTextContext ? { attachTextContext: (provider) => binding.attachTextContext!(provider) } : undefined;
  }

  /** @inheritdoc */
  protected activateMountedServiceText(
    target: QuireMountedTextTarget,
    options?: QuireMountedTextActivationOptions
  ): boolean {
    return this.mountedRuntime.interaction.activateText(target, options);
  }

  /** @param clientY - Pointer height in CSS pixels. @returns Exact nearby body block fragments; none while a header/footer owns editing. */
  queryBlockFragments(clientY: number): readonly QuireMountedBlockFragment[] {
    if (this.mountedRuntime.interaction.getHeaderFooterEditingSession() !== null) return [];
    return this.mountedRuntime.geometry.queryBlockFragments(clientY);
  }
  /** @param position - Inline source coordinate. @param sourceDocument - Exact source identity. @returns Document CSS-pixel content width, or null. */
  getTextblockContentWidth(position: number, sourceDocument: import("@quirekit/pm").Node): number | null {
    return this.mountedRuntime.geometry.getTextblockContentWidth(position, sourceDocument);
  }

  /** @param range - Explicit half-open range. @param sourceDocument - Exact source identity. @returns Passive client-space line bands or unavailable. */
  getTextRangeRects(range: import("@quirekit/renderer").QuireDocumentRange, sourceDocument: import("@quirekit/pm").Node): readonly import("@quirekit/core").QuireMountedTextRangeRect[] | null {
    return this.mountedRuntime.geometry.getTextRangeRects(range, sourceDocument);
  }

  /** @param range - Explicit half-open range. @param sourceDocument - Exact source identity. @returns Passive client-space boxes of structured targets, such as table cells, or unavailable. */
  getStructuredRangeRects(range: import("@quirekit/renderer").QuireDocumentRange, sourceDocument: import("@quirekit/pm").Node): readonly import("@quirekit/core").QuireMountedTextRangeRect[] | null {
    return this.mountedRuntime.geometry.getStructuredRangeRects(range, sourceDocument);
  }

  /** @returns The presented caret in client CSS pixels, including IME preview, or null without a caret. */
  getCaretRect(): import("@quirekit/core").QuireMountedCaretRect | null {
    return this.mountedRuntime.geometry.getCaretRect();
  }

  /** @param event - Primary pointer press. @param lease - Semantic callbacks. @returns Cancellation or refusal. */
  beginBlockDrag(event: PointerEvent, lease: QuireBlockPointerLease): (() => void) | null {
    return beginMountedBlockPointerLease(this, event, lease);
  }

  /**
   * Canonical scheduling, interaction, geometry, and transient runtime.
   *
   * @returns Initialized paginated mounted runtime.
   */
  protected get mountedRuntime(): MountedPaginatedRuntime {
    if (this.mountedRuntimeValue === undefined) {
      throw new RangeError(
        `${this.mode} mounted runtime was read before backend initialization`
      );
    }

    return this.mountedRuntimeValue;
  }

  /**
   * Initializes shared ownership from the backend capabilities that differ.
   *
   * @param options - Backend scheduling, host, geometry, presentation, and render capabilities.
   * @returns Canonical paginated mounted runtime.
   */
  protected initializeMountedPaginatedRuntime(
    options: InitializeMountedPaginatedEditorViewOptions
  ): MountedPaginatedRuntime {
    if (this.mountedRuntimeValue !== undefined) {
      throw new RangeError(`${this.mode} mounted runtime is already initialized`);
    }

    const runtime = createMountedPaginatedRuntime({
      scheduling: {
        ...options.scheduling,
        readFocused: () => this.hasFocus(),
        requestDeferredPostUpdate: () => {
          this.postUpdateGeneration += 1;
        },
        completeDeferredPostUpdate: () => {
          this.completeDeferredMountedPostUpdate();
        }
      },
      interaction: {
        lifecycle: {
          host: options.interaction.host,
          eventHandlers: this.editor.extensionManager.viewEventHandlers,
          getWidgetContext: () => ({
            editor: this.editor,
            view: this,
            mode: this.mode,
            status: this.status
          }),
          status: this.status,
          editor: this.editor,
          inputProxy: this.elements.inputProxy,
          readEditable: () => this.editable,
          root: this.elements.root,
          overlayHost: this.elements.overlayHost,
          ...(options.interaction.onDrawingCreationActiveChange === undefined
            ? {}
            : {
                onDrawingCreationActiveChange:
                  options.interaction.onDrawingCreationActiveChange
              })
        },
        ...(options.interaction.onFocusChange === undefined
          ? {}
          : { onFocusChange: options.interaction.onFocusChange })
      },
      geometry: options.geometry,
      presentation: {
        lifecycle: {
          ...options.presentation.lifecycle,
          ownerDocument: this.elements.root.ownerDocument,
          overlayHost: this.elements.overlayHost,
          readState: () => this.editor.state,
          decorationSourceView: this,
          readFocused: () => this.hasMountedFocusState(),
          readEditable: () => this.editable,
          readDestroyed: () => this.isMountedViewDestroyed(),
          setFocusedState: (focused) => {
            this.setMountedFocusState(focused);
          }
        },
        syncInputProxy: options.presentation.syncInputProxy
      },
      renderFlow: {
        lifecycle: {
          ...options.renderFlow.lifecycle,
          renderDocument: (request) => {
            this.presentationOverlayPending = false;
            options.renderFlow.lifecycle.renderDocument(request);
          },
          initialReason: "initial",
          documentReplaceReason: "document-replace",
          transactionReason: "transaction",
          compositionReason: "composition",
          readDestroyed: () => this.isMountedViewDestroyed(),
          readFocused: () => this.hasFocus(),
          readTopLevelBlockCount: () => this.editor.state.doc.childCount,
          documentProfile: resolveQuireDocumentProfile(this.editor.extensionManager),
          readSelectionHeadTopLevelBlockIndex: () =>
            this.editor.state.doc
              .resolve(this.editor.state.pm.selection.head)
              .index(0)
        },
        // Retained selection paint predates a pending overlay change.
        allowsSelectionReuse: () =>
          !this.presentationOverlayPending && options.renderFlow.allowsSelectionReuse(),
        isDocumentPresentationReady:
          options.renderFlow.isDocumentPresentationReady
      }
    });

    this.mountedRuntimeValue = runtime;
    registerMountedPresentationTarget(this, this.elements.root, () => {
      this.presentationOverlayPending = true;
      this.requestPaginatedRender({ reason: "presentation-overlay" });
    });
    this.setMountedWidgetEventRuntime(runtime.interaction.widgetEvents);

    return runtime;
  }

  /** Focuses the canonical hidden input proxy. */
  protected focusEditableTarget(): void {
    this.mountedRuntime.interaction.focusInput();
  }

  /**
   * Reads the canonical pointer target retained by the shared interaction lifecycle.
   *
   * @returns Clone-safe semantic target facts, or null without retained ownership.
   */
  override getInteractionTargetSnapshot(): QuireMountedInteractionTargetSnapshot | null {
    return this.mountedRuntime.interaction.getInteractionTargetSnapshot();
  }

  /**
   * Arms one one-shot drawing creation gesture on this paginated view.
   *
   * @param options - Drawing family, default extent, and optional identities.
   * @returns Whether the primary editable view accepted the tool.
   */
  armDrawingCreation(options?: MountedDrawingCreationOptions): boolean {
    return this.mountedRuntime.interaction.armDrawingCreation(options);
  }

  /**
   * Enters the current drawing's independent text Story through mounted input ownership.
   * @returns Whether current selection and retained geometry prove the exact editable Story.
   */
  enterSelectedDrawingText(): boolean {
    if (!this.editor.isEditable) return false;
    return this.mountedRuntime.interaction.enterSelectedDrawingText();
  }

  /**
   * Cancels armed or captured drawing creation without source mutation.
   *
   * @returns Whether active creation state was cleared.
   */
  cancelDrawingCreation(): boolean {
    return this.mountedRuntime.interaction.cancelDrawingCreation();
  }

  /**
   * Maps viewport coordinates through canonical retained geometry.
   *
   * @param coords - Viewport coordinates in CSS pixels.
   * @returns Document position near the coordinates, or null when unavailable.
   */
  posAtCoords(coords: QuireViewViewportCoords): QuireViewPosAtCoordsResult | null {
    return this.mountedRuntime.geometry.posAtCoords(coords);
  }

  /**
   * Maps a document position through canonical retained geometry.
   *
   * @param pos - Document position to map.
   * @param side - Side preference at an ambiguous boundary.
   * @returns Viewport rectangle for the document position.
   */
  coordsAtPos(pos: number, side = 1): QuireViewCoordsAtPosResult {
    return this.mountedRuntime.geometry.coordsAtPos(pos, side);
  }

  /**
   * Resolves one retained object anchor against the current committed snapshot.
   *
   * @param objectId - Stable object identity carried by the retained hit target.
   * @param occurrence - Optional exact target or repeated visual occurrence.
   * @returns Client-space object geometry or explicit stale/unsupported state.
   */
  getObjectAnchor(
    objectId: string,
    occurrence?: QuireMountedObjectAnchorOccurrence
  ): QuireMountedObjectAnchorResolution {
    return this.mountedRuntime.geometry.getObjectAnchor(
      objectId,
      resolveMountedObjectAnchorOccurrence(
        objectId,
        occurrence,
        this.mountedRuntime.interaction.getInteractionTarget()
      )
    );
  }

  /**
   * Resolves one version-bound Editor UI anchor through retained geometry.
   * @param request - Explicit typed anchor request.
   * @returns Client-space geometry or explicit stale/unsupported state.
   */
  resolveUIAnchor(
    request: EditorUIAnchorRequest
  ): EditorUIClientAnchorResolution {
    return this.mountedRuntime.geometry.resolveUIAnchor(request);
  }

  /**
   * Resolves page-fragment-aware Table chrome through retained geometry.
   *
   * @param tablePos - Absolute position immediately before the table node.
   * @param activePosition - Canonical position used to choose the visual occurrence.
   * @returns Viewport-projected Table chrome, or null when unavailable.
   */
  override getTableChrome(
    tablePos: number,
    activePosition: number
  ): QuireMountedTableChromeModel | null {
    return this.mountedRuntime.geometry.getTableChrome(
      tablePos,
      activePosition
    );
  }

  /**
   * Reports whether movement would leave the current retained textblock.
   *
   * @param direction - Movement direction to test.
   * @returns Whether the selection sits at the textblock boundary.
   */
  endOfTextblock(direction: QuireViewTextblockDirection): boolean {
    return this.mountedRuntime.geometry.endOfTextblock(direction);
  }

  /**
   * Projects a shared editor update into the canonical paginated scheduler.
   *
   * @param options - Shared editor update facts.
   */
  protected updateMountedView(options: QuireMountedEditorViewUpdateOptions): void {
    validateMountedBlockPointerLease(this);
    this.requestPaginatedRender({
      reason: options.reason,
      ...(options.transactions === undefined
        ? {}
        : { transactions: options.transactions })
    });
  }

  /** @inheritdoc */
  protected override completesMountedPostUpdate = true;

  /** @inheritdoc */
  protected resolveMountedSelectionScrollRect(): MountedViewScrollRect | null {
    return this.mountedRuntime.geometry.resolveSelectionScrollRect();
  }

  /** @inheritdoc */
  protected resolveMountedPositionScrollRect(
    position: number
  ): MountedViewScrollRect | null {
    return this.mountedRuntime.geometry.resolvePositionScrollRect(position);
  }

  /** @inheritdoc */
  protected override resolveMountedPageScrollRect(
    position: number
  ): MountedViewScrollRect | null {
    return this.mountedRuntime.geometry.resolvePageScrollRect(position);
  }

  /**
   * Enqueues a canonical render request without carrying an editor alias.
   *
   * @param request - Reason, transactions, and optional transient IME facts.
   */
  protected requestPaginatedRender(
    request: MountedPaginatedRuntimeRequest
  ): void {
    this.mountedRuntime.updates.request(request);
  }

  /** Releases the shared runtime before backend presentation resources. */
  protected destroyMountedView(): void {
    this.mountedRuntime.destroy();
    this.destroyPaginatedBackendView();
  }

  /** Releases presentation and measurement resources owned by one backend. */
  protected abstract destroyPaginatedBackendView(): void;
}

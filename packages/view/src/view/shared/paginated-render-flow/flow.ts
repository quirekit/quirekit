import {
  deriveQuireLayoutDirtyRangeFromTransactions,
  deriveQuireViewUpdatePatch,
  type QuireImePreedit,
  type QuireLayoutDirtyRange
} from "@quirekit/view-engine";
import type { QuirePageStackFillAdvance } from "../page-stack";
import type {
  CreateMountedPaginatedRenderFlowOptions,
  MountedPaginatedDocumentRenderRequest,
  MountedPaginatedRenderFlow,
  MountedPaginatedRenderUpdate
} from "./types";
import { mapQuireImePreedit } from "./ime-preedit";

/** Default implementation of the mounted paginated render-flow contract. */
class DefaultMountedPaginatedRenderFlow<Reason extends string>
  implements MountedPaginatedRenderFlow<Reason>
{
  private currentImePreedit: QuireImePreedit | undefined;

  /**
   * Creates one shared render flow over backend-owned execution capabilities.
   *
   * @param options - Semantic reason identities and backend callbacks.
   */
  constructor(
    private readonly options: CreateMountedPaginatedRenderFlowOptions<Reason>
  ) {}

  /** @inheritdoc */
  get imePreedit(): QuireImePreedit | undefined {
    return this.currentImePreedit;
  }

  /** @inheritdoc */
  renderUpdate(update: MountedPaginatedRenderUpdate<Reason>): void {
    if (this.options.readDestroyed()) {
      return;
    }

    // Composition owns speculative text lifetime. Other update reasons retain
    // that state so scroll and background fill cannot make preedit disappear,
    // and carry it over document changes that arrive mid-composition.
    if (update.reason === this.options.compositionReason) {
      this.currentImePreedit = update.imePreedit;
    } else {
      this.currentImePreedit = mapQuireImePreedit(this.currentImePreedit, update.transactions);
    }

    const layoutDirtyRange = deriveQuireLayoutDirtyRangeFromTransactions(
      update.transactions, this.options.documentProfile
    );
    const updatePatch = deriveQuireViewUpdatePatch({
      reason: update.reason,
      transactions: update.transactions,
      layoutDirtyRange
    });

    if (this.options.canReuseSelectionUpdate(update.reason, {
      reason: update.reason,
      imePreedit: this.currentImePreedit,
      layoutDirtyRange,
      updatePatch
    })) {
      this.options.renderSelectionUpdate(update.reason, updatePatch);
      return;
    }

    this.options.renderDocument(this.createDocumentRequest(
      update.reason,
      layoutDirtyRange,
      updatePatch,
      update.reason === this.options.initialReason
        || update.reason === this.options.documentReplaceReason
    ));
  }

  /** @inheritdoc */
  refreshDocument(reason: Reason): void {
    if (
      this.options.readDestroyed()
      || !this.options.canRefreshDocument()
    ) {
      return;
    }

    const layoutDirtyRange = null;
    const updatePatch = deriveQuireViewUpdatePatch({
      reason,
      layoutDirtyRange
    });
    this.options.renderDocument(this.createDocumentRequest(
      reason,
      layoutDirtyRange,
      updatePatch,
      false
    ));
  }

  /** @inheritdoc */
  applyFillAdvance(reason: Reason, advance: QuirePageStackFillAdvance): void {
    if (
      this.options.readDestroyed()
      || !advance.render
      || !this.options.canRefreshDocument()
    ) {
      return;
    }

    this.options.renderDocument({
      reason,
      ...(this.currentImePreedit === undefined
        ? {}
        : { imePreedit: this.currentImePreedit }),
      layoutDirtyRange: null,
      updatePatch: deriveQuireViewUpdatePatch({
        reason,
        layoutDirtyRange: null
      }),
      fillWindow: {
        ...(advance.blockLimit === undefined
          ? {}
          : { maxBlocks: advance.blockLimit }),
        initialWindowActive: false
      }
    });
  }

  /**
   * Builds one document request after resolving focused fill ownership.
   *
   * @param reason - Semantic render reason.
   * @param layoutDirtyRange - Canonical dirty range for this update.
   * @param updatePatch - Canonical retained invalidation patch.
   * @param initial - Whether this is the mount's initial document render.
   * @returns Backend-neutral document render request.
   */
  private createDocumentRequest(
    reason: Reason,
    layoutDirtyRange: QuireLayoutDirtyRange | null,
    updatePatch: MountedPaginatedDocumentRenderRequest<Reason>["updatePatch"],
    initial: boolean
  ): MountedPaginatedDocumentRenderRequest<Reason> {
    const interactionFirstDirtyBlockIndex =
      this.resolveInteractionFirstDirtyBlockIndex(reason, layoutDirtyRange);
    const fillWindow = this.options.prepareFillRender({
      totalBlockCount: this.options.readTopLevelBlockCount(),
      initial,
      ...(interactionFirstDirtyBlockIndex === undefined
        ? {}
        : { interactionFirstDirtyBlockIndex })
    });

    return {
      reason,
      ...(this.currentImePreedit === undefined
        ? {}
        : { imePreedit: this.currentImePreedit }),
      layoutDirtyRange,
      updatePatch,
      ...(fillWindow === undefined ? {} : { fillWindow })
    };
  }

  /**
   * Resolves the top-level block that must stay inside a focused render window.
   *
   * @param reason - Semantic render reason.
   * @param layoutDirtyRange - Canonical dirty range for this update.
   * @returns Focused top-level block index, or undefined outside focused edits.
   */
  private resolveInteractionFirstDirtyBlockIndex(
    reason: Reason,
    layoutDirtyRange: QuireLayoutDirtyRange | null
  ): number | undefined {
    if (
      (reason !== this.options.transactionReason
        && reason !== this.options.compositionReason)
      || !this.options.readFocused()
    ) {
      return undefined;
    }

    return layoutDirtyRange?.firstTopLevelBlockIndex
      ?? this.options.readSelectionHeadTopLevelBlockIndex();
  }
}

/**
 * Creates shared mounted update, viewport refresh, and fill-advance authority.
 *
 * @param options - Semantic reason identities and backend execution capabilities.
 * @returns Mounted paginated render flow with private IME state.
 */
export function createMountedPaginatedRenderFlow<Reason extends string>(
  options: CreateMountedPaginatedRenderFlowOptions<Reason>
): MountedPaginatedRenderFlow<Reason> {
  return new DefaultMountedPaginatedRenderFlow(options);
}

import type { QuireLayoutNode, QuireRetainedLayoutSnapshot } from "@quirekit/view-engine";
import type { HtmlFlowGeometryOptions } from "../types";
import { measureHtmlFlowSnapshot } from "../snapshot";
import { admitHtmlBlockFlow } from "./eligibility";
import { updateHtmlFlowRects } from "./flow";
import { HtmlFlowGeometryInvalidation } from "./invalidation";
import { hasHtmlInteractiveLayoutStyles } from "./interaction-styles";
import type { HtmlFlowGeometryCache, HtmlFlowGeometryDiagnostics, HtmlFlowGeometryProduct, HtmlFlowGeometryUpdate } from "./types";

/** Owns verified native-flow reuse, complete fallbacks and immutable geometry products. */
export class HtmlFlowGeometryRuntime {
  private cache: HtmlFlowGeometryCache | undefined;
  private invalidation: HtmlFlowGeometryInvalidation | undefined;
  private admissionRejected = false;
  private blockReads = 0;
  private latest: HtmlFlowGeometryDiagnostics = { mode: "full", blockReads: 0, reusedRects: 0, indexBuilds: 0, indexRefits: 0 };

  /** @returns Actual geometry work performed by the last presentation. */
  get diagnostics(): HtmlFlowGeometryDiagnostics { return this.latest; }

  /** @param surface - Content surface just sized by the authorized overlay phase. */
  acceptSurfaceSize(surface: HTMLElement): void { this.invalidation?.acceptSurfaceSize(surface); }

  /**
   * Publishes complete geometry after current retained DOM writes have settled.
   * @param options - Current canonical state, DOM and surface dimensions.
   * @param update - Exact reconciliation and scheduling evidence.
   * @param previous - Last committed snapshot, including selection-only states.
   * @param reuse - Whether the presentation proved no content or size changes.
   * @returns Current snapshot and optional stable-topology hit-tree patch.
   */
  measure(options: HtmlFlowGeometryOptions, update: HtmlFlowGeometryUpdate,
    previous?: QuireRetainedLayoutSnapshot, reuse = false): HtmlFlowGeometryProduct {
    const root = options.documentView.root.mount!.dom as HTMLElement;
    this.invalidation ??= new HtmlFlowGeometryInvalidation(root);
    const invalidated = this.invalidation.consume();
    const interactionChanged = this.invalidation.consumeInteraction(), trace = update.trace;
    if (interactionChanged) this.cache = undefined;
    if (invalidated || interactionChanged || trace?.structureWrites.length || trace?.attributeWrites.length
      || trace?.decorationWrites || trace?.rootReplacements || update.reason === "manual"
      || previous?.documentRect.width !== options.surfaceState.surfaceBounds.width) this.admissionRejected = false;
    this.blockReads = 0;
    if (reuse && previous && !invalidated && (update.reason !== "resize" || this.cache)) {
      this.latest = { mode: "reuse", blockReads: 0, reusedRects: 0, indexBuilds: 0, indexRefits: 0 };
      return { snapshot: { ...previous, state: options.editor.state } };
    }
    if (invalidated) this.cache = undefined;
    const retained = this.tryRetained(options, update);
    if (retained) return retained;

    const snapshot = measureHtmlFlowSnapshot({ ...options, onBlockRead: this.recordRead });
    const blocks = this.invalidation.observable && !this.admissionRejected ? admitHtmlBlockFlow(options.documentView) : null;
    const children = snapshot.root.children ?? [];
    if (blocks && blocks.length === children.length && blocks.every((block, i) => block.id === children[i]!.id)
      && children.every(block => block.rect.height > 0 && block.rect.width > 0)) {
      const origin = options.surface.getBoundingClientRect(), rect = root.getBoundingClientRect();
      this.cache = { snapshot, blocks, indexes: new Map(blocks.map((block, index) => [block.id, index])),
        rects: children.map(block => block.rect), origin: { x: rect.left - origin.left, y: rect.top - origin.top } };
    } else this.cache = undefined;
    this.admissionRejected = !this.cache;
    this.invalidation.setInteractionLayoutDependency(!this.cache || hasHtmlInteractiveLayoutStyles(root));
    this.latest = { mode: "full", blockReads: this.blockReads, reusedRects: 0, indexBuilds: 1, indexRefits: 0 };
    return { snapshot };
  }

  /** Releases all mounted dependencies and retained geometry. */
  destroy(): void { this.invalidation?.destroy(); this.invalidation = undefined; this.cache = undefined; this.admissionRejected = false; }

  /** Records one native block box read without querying any layout itself. */
  private readonly recordRead = (): void => { this.blockReads++; };

  /**
   * Attempts the proven native-flow path; every unproved dependency falls back.
   * @param options - Current state and browser geometry authority.
   * @param update - Actual DOM write evidence.
   * @returns Incremental products, or null when complete measurement is required.
   */
  private tryRetained(options: HtmlFlowGeometryOptions, update: HtmlFlowGeometryUpdate): HtmlFlowGeometryProduct | null {
    const cache = this.cache, trace = update.trace;
    if (!cache || update.reason !== "transaction" || update.compositionWrites || !trace
      || trace.structureWrites.length || trace.attributeWrites.length || trace.decorationWrites
      || trace.nodeViewUpdateAttempts || trace.rootReplacements
      || !cache.snapshot.state.doc.sameMarkup(options.editor.state.doc)
      || cache.snapshot.documentRect.width !== options.surfaceState.surfaceBounds.width) return null;

    const changed = new Set<number>();
    for (const id of trace.textWrites) {
      let descriptor = options.documentView.descriptorById(id);
      while (descriptor?.parent && descriptor.parent !== options.documentView.root) descriptor = descriptor.parent;
      const index = descriptor && cache.indexes.get(descriptor.id);
      if (!descriptor || index === undefined || descriptor !== cache.blocks[index] || descriptor.kind !== "node"
        || descriptor.node.content.size === 0) return null;
      changed.add(index);
    }
    if (changed.size === 0) return null;
    const origin = options.surface.getBoundingClientRect();
    const root = (options.documentView.root.mount!.dom as HTMLElement).getBoundingClientRect();
    if (Math.abs(root.left - origin.left - cache.origin.x) > 0.02
      || Math.abs(root.top - origin.top - cache.origin.y) > 0.02) return null;
    const rects = updateHtmlFlowRects({ previous: cache.rects, changed: [...changed],
      previousHeight: cache.snapshot.documentRect.height, height: options.surfaceState.surfaceBounds.height,
      read: index => {
        this.recordRead();
        const rect = (cache.blocks[index]!.mount!.dom as Element).getBoundingClientRect();
        return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height };
      } });
    if (!rects) return null;

    // Bind immutable source ranges separately from layout. Prefix nodes whose
    // source and box are unchanged remain shared with the prior snapshot.
    const changedBlocks = new Map<string, QuireLayoutNode>();
    const blocks = cache.blocks.map((descriptor, index) => {
      const before = cache.snapshot.root.children![index]!, rect = rects[index]!;
      if (rect === before.rect && sameRange(before.range, descriptor.range)) return before;
      const node = { ...before, range: descriptor.range, rect,
        layoutOwner: { ...before.layoutOwner!, source: descriptor.source } };
      changedBlocks.set(node.id, node);
      return node;
    });
    const snapshot = measureHtmlFlowSnapshot({ ...options, retainedBlocks: blocks, previousSnapshot: cache.snapshot });
    this.cache = { ...cache, snapshot, rects };
    this.latest = { mode: "incremental", blockReads: this.blockReads,
      reusedRects: rects.reduce((count, rect, i) => count + Number(rect === cache.rects[i]), 0), indexBuilds: 0, indexRefits: 1 };
    return { snapshot, changedBlocks };
  }
}

/** @param a - Previous source range. @param b - Current mapped range. @returns Whether the source interval is unchanged. */
function sameRange(a: QuireLayoutNode["range"], b: QuireLayoutNode["range"]): boolean {
  return a.from === b.from && a.to === b.to;
}

import {
  createHtmlDocumentDescriptor,
  type HtmlDescriptorSourceResolver,
  type HtmlDocumentDesc
} from "../descriptors";
import {
  HtmlDomMappingGapError,
  htmlDomMappingGapCode
} from "../reconcile/ownership/mapping-gap";
import { HtmlDescriptorPositionIndex } from "../reconcile/ownership/position-index";
import { reconcileHtmlDescriptorTree } from "../reconcile/reconcile";
import type {
  CreateHtmlRetainedDocumentViewOptions,
  HtmlDocumentUpdateOptions,
  HtmlDomPoint,
  HtmlRetainedDocumentView
} from "./types";
import type { HtmlNodeViewEnvironment } from "../node-view/types";
import type { DecorationSource } from "@quirekit/pm";

export { HtmlDomMappingGapError, htmlDomMappingGapCode };

/**
 * Creates one persistent retained HTML document facade.
 *
 * @param options - Initial document, browser document, id, and source.
 * @returns Persistent descriptor-owned document view.
 */
export function createHtmlRetainedDocumentView(
  options: CreateHtmlRetainedDocumentViewOptions
): HtmlRetainedDocumentView {
  return new HtmlRetainedDocumentViewRuntime(options);
}

/** Internal persistent retained document facade implementation. */
class HtmlRetainedDocumentViewRuntime implements HtmlRetainedDocumentView {
  /** @inheritdoc */
  readonly root: HtmlDocumentDesc;
  private readonly ownerDocument: Document;
  private readonly idPrefix: string;
  private readonly resolveSource: HtmlDescriptorSourceResolver | undefined;
  private readonly nodeViewEnvironment: HtmlNodeViewEnvironment | undefined;
  private readonly positionIndex: HtmlDescriptorPositionIndex;
  private nextDescriptorId = 0;
  private destroyed = false;
  private decorationSource: DecorationSource | undefined;

  /**
   * Creates and indexes one retained document tree.
   *
   * @param options - Initial document facade inputs.
   */
  constructor(options: CreateHtmlRetainedDocumentViewOptions) {
    this.ownerDocument = options.ownerDocument;
    this.idPrefix = options.id;
    this.resolveSource = options.resolveSource;
    this.nodeViewEnvironment = options.nodeViewEnvironment;
    this.decorationSource = options.nodeViewEnvironment?.getDecorations();
    const created = createHtmlDocumentDescriptor({
      ...options,
      allocateId: this.allocateId
    });

    this.root = created.descriptor;
    this.positionIndex = new HtmlDescriptorPositionIndex(this.root);
  }

  /** @inheritdoc */
  update(options: HtmlDocumentUpdateOptions) {
    this.assertActive();
    const decorationSource = this.nodeViewEnvironment?.getDecorations();
    const result = reconcileHtmlDescriptorTree({
      root: this.root,
      documentNode: options.documentNode,
      mapping: options.mapping,
      changedRanges: options.changedRanges,
      ownerDocument: this.ownerDocument,
      allocateId: this.allocateId,
      resolveSource: this.resolveSource,
      nodeViewEnvironment: this.nodeViewEnvironment,
      decorationsChanged: decorationSource !== this.decorationSource
        && !(decorationSource && this.decorationSource && decorationSource.eq(this.decorationSource))
    });

    this.decorationSource = decorationSource;
    if (result.ownershipChanged || this.positionIndex.requiresMountValidation()) {
      this.positionIndex.rebuild(this.root);
    }
    return result;
  }

  /** @inheritdoc */
  domAtPos(pos: number, side = 0): HtmlDomPoint {
    this.assertActive();
    return this.positionIndex.resolveDomPoint(pos, side);
  }

  /** @inheritdoc */
  posAtDOM(node: Node, offset: number, bias = 0): number {
    this.assertActive();
    return this.positionIndex.resolvePosition(node, offset, bias);
  }

  /** @inheritdoc */
  nodeDOM(pos: number): Node | null {
    this.assertActive();
    return this.positionIndex.resolveNodeDom(pos);
  }

  /** @inheritdoc */
  ownerAtDOM(node: Node) {
    this.assertActive();
    return this.positionIndex.resolveOwner(node);
  }

  /** @inheritdoc */
  descriptorById(descriptorId: string) {
    this.assertActive();
    return this.positionIndex.resolveDescriptor(descriptorId);
  }

  /** @inheritdoc */
  descriptorsInRange(range: { readonly from: number; readonly to: number }) {
    this.assertActive();
    return this.positionIndex.resolveDescriptorsInRange(range);
  }

  /** @inheritdoc */
  stopEvent(event: Event): boolean {
    this.assertActive();
    const target = event.target;
    if (!target || !("nodeType" in target)) {
      return false;
    }
    for (let owner = this.positionIndex.resolveOwner(target as Node); owner; owner = owner.parent ?? undefined) {
      if ((owner.kind === "widget" && owner.decoration.spec.stopEvent?.(event))
        || (owner.kind === "node-view" && owner.host?.stopEvent(event))) {
        return true;
      }
    }
    return false;
  }

  /** @inheritdoc */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.root.destroy();
    this.positionIndex.clear();
    this.destroyed = true;
  }

  /**
   * Allocates one monotonic descendant id without changing retained ids.
   *
   * @returns Next document-local descriptor identity.
   */
  private readonly allocateId = (): string => {
    this.nextDescriptorId += 1;
    return `${this.idPrefix}:desc:${this.nextDescriptorId}`;
  };

  /** Throws an explicit mapping gap after lifecycle release. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new HtmlDomMappingGapError(
        "Retained HTML document view has been destroyed."
      );
    }
  }
}

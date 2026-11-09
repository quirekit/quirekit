import type { Node as ProseMirrorNode } from "@quirekit/pm";
import type { QuireLayoutNode } from "@quirekit/view-engine";
import type { CreateHtmlDomMeasurementProviderOptions } from "../types";
import { createHtmlBlockHitTree, queryHtmlBlockHitTree } from "./regions";
import { refitHtmlBlockHitTree } from "./refit";
import type { HtmlBlockHitGeometry, HtmlBlockHitTree } from "./types";

/**
 * Keeps only the current measured index and projects scrolling at query time.
 * @param options - Retained document and its CSS coordinate surface.
 * @returns Document-owned spatial query lifecycle.
 */
export function createHtmlBlockHitGeometry(options: CreateHtmlDomMeasurementProviderOptions): HtmlBlockHitGeometry {
  let root: QuireLayoutNode | undefined, document: ProseMirrorNode | undefined, tree: HtmlBlockHitTree | null = null;
  return {
    /** @param nextRoot - Published block geometry. @param nextDocument - Canonical document owning it. @param changed - Verified stable-topology source/box changes. */
    update(nextRoot, nextDocument, changed) {
      if (root !== nextRoot) tree = root && changed ? refitHtmlBlockHitTree(tree, changed) : createHtmlBlockHitTree(nextRoot);
      root = nextRoot; document = nextDocument;
    },
    /** @param left - Client x. @param top - Client y. @param scope - Enclosing owner range. @returns Current local block. */
    atPoint(left, top, scope) {
      if (!tree || document !== options.documentView.root.node) return null;
      const origin = options.surface.getBoundingClientRect();
      const { block } = queryHtmlBlockHitTree(tree, { x: left - origin.left, y: top - origin.top }, scope);
      const descriptor = block && options.documentView.descriptorById(block.id);
      if (!block || !descriptor || descriptor.destroyed || !descriptor.mount
        || descriptor.range.from !== block.range.from || descriptor.range.to !== block.range.to) return null;
      return { descriptor, rect: { ...block.rect, x: block.rect.x + origin.left, y: block.rect.y + origin.top } };
    }
  };
}

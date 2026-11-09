import type { QuireLayoutNode } from "@quirekit/view-engine";
import type { HtmlBlockHitTree } from "./types";

/**
 * Refits an existing spatial partition after topology-preserving flow updates.
 * @param tree - Immutable previous hit tree.
 * @param changed - Current blocks whose ranges or rectangles changed.
 * @returns Current bounds and sources, sharing every unaffected branch.
 */
export function refitHtmlBlockHitTree(tree: HtmlBlockHitTree | null,
  changed: ReadonlyMap<string, QuireLayoutNode>): HtmlBlockHitTree | null {
  if (!tree) return null;
  if (tree.block) {
    const block = changed.get(tree.block.id);
    return block ? { rect: block.rect, range: block.range, block } : tree;
  }
  const first = refitHtmlBlockHitTree(tree.first!, changed)!, second = refitHtmlBlockHitTree(tree.second!, changed)!;
  if (first === tree.first && second === tree.second) return tree;
  const x = Math.min(first.rect.x, second.rect.x), y = Math.min(first.rect.y, second.rect.y);
  const rect = first.rect === tree.first!.rect && second.rect === tree.second!.rect ? tree.rect : {
    x, y, width: Math.max(first.rect.x + first.rect.width, second.rect.x + second.rect.width) - x,
    height: Math.max(first.rect.y + first.rect.height, second.rect.y + second.rect.height) - y
  };
  return { first, second, rect,
    range: { from: Math.min(first.range.from, second.range.from), to: Math.max(first.range.to, second.range.to) } };
}

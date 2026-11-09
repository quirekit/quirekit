import type { Editor } from "@quirekit/core";
import type { EditorBlockOccurrence } from "@quirekit/editor-ui";
import { editorUITableChromeOutset } from "@quirekit/editor-ui/vue";
import { quireBlockHandleWidth } from "@quirekit/ui/vue";
import type { BlockRailGeometry } from "./types";

/** Shared public control dimensions, used for placement and pointer corridors. */
export const blockRailMetrics = { handle: quireBlockHandleWidth, control: 24, gap: 4 } as const;

/**
 * Reads only the current block, after the mounted View has resolved its occurrence.
 * @param editor - Geometry owner.
 * @param occurrence - Exact current source and client rectangle.
 * @returns The handle's right edge and vertical center in client CSS pixels.
 */
export function blockRailAnchor(editor: Editor, occurrence: EditorBlockOccurrence): BlockRailGeometry {
  const dom = editor.view.nodeDOM?.(occurrence.block.from);
  const element = dom instanceof Element ? dom : null;
  const content = contentAnchor(editor, occurrence, element);
  // The table's row and insertion controls own the leading strip. Reserve it
  // even before hover chrome mounts so the block handle never jumps or covers it.
  const anchor = occurrence.block.node.type.spec.tableRole === "table"
    ? { ...content, x: occurrence.fragment.rect.x - editorUITableChromeOutset - blockRailMetrics.gap, contentEdge: occurrence.fragment.rect.x }
    : content;
  const column = element?.closest("[data-qk-column]"), previous = column?.previousElementSibling;
  if (!previous?.matches("[data-qk-column]")) return anchor;
  const current = column!.getBoundingClientRect(), before = previous.getBoundingClientRect();
  const width = blockRailMetrics.handle + (occurrence.block.node.content.size ? 0 : blockRailMetrics.control + blockRailMetrics.gap);
  // Only a side-by-side column reserves the gap. The current block and its
  // immediate neighbour are sufficient; stacked layouts keep normal placement.
  if (before.right <= current.left && anchor.x > before.right && anchor.x - width < current.left) {
    return { ...anchor, x: before.right - blockRailMetrics.gap, contentEdge: Math.max(current.left, anchor.contentEdge ?? anchor.x) };
  }
  return anchor;
}

/** @param editor - Geometry owner. @param occurrence - Current block. @param element - Mounted block DOM. @returns Content-aligned handle anchor. */
function contentAnchor(editor: Editor, occurrence: EditorBlockOccurrence, element: Element | null): BlockRailGeometry {
  const { block, fragment: { rect } } = occurrence;
  // Only a heading's own disclosure reserves a lane; a container's descendants
  // must not push the outer handle away from its border.
  const fold = block.node.type.name === "heading" ? element?.querySelector<HTMLElement>(".qk-block-section-toggle") : null;
  if (fold) {
    const control = fold.getBoundingClientRect();
    return { x: control.left - 4, y: control.top + control.height / 2, disclosure: fold.id };
  }
  // NodeViews nominate their own header; only a direct child can anchor this
  // block, so a nested container never pulls its parent's handle inward.
  const header = element?.querySelector(":scope > [data-block-rail-anchor]")?.getBoundingClientRect();
  if (header?.height) return { x: rect.x - 6, y: header.top + header.height / 2 };
  if (block.node.isTextblock && block.node.type.name !== "codeBlock") {
    const line = editor.view.coordsAtPos(block.from + 1);
    const marker = element?.querySelector("[data-block-list-marker]")?.getBoundingClientRect();
    return { x: (marker?.left ?? rect.x) - 6, y: (line.top + line.bottom) / 2 };
  }
  // Text containers without header chrome use their first content line. This
  // follows one ancestor chain, never a scan of sibling blocks or the document.
  let first = block.node, position = block.from;
  while (!first.isTextblock && first.firstChild) { first = first.firstChild; position += 1; }
  if (first.isTextblock) {
    const line = editor.view.coordsAtPos(position + 1);
    return { x: rect.x - 6, y: (line.top + line.bottom) / 2 };
  }
  return { x: rect.x - 6, y: rect.y + Math.min(rect.height, 28) / 2 };
}

/** @param anchor - Retained current geometry. @param point - Latest client point. @returns Whether the pointer is crossing reserved controls to reach its shifted handle. */
export function inBlockRailCorridor(anchor: BlockRailGeometry | null, point: { x: number; y: number }): boolean {
  return !!anchor?.contentEdge && point.x >= anchor.x && point.x <= anchor.contentEdge
    && Math.abs(point.y - anchor.y) <= blockRailMetrics.control / 2;
}

/** @param previous - Retained hover. @param next - Latest nearby result. @returns Whether source and measured client geometry are unchanged. */
export function sameBlockOccurrence(previous: EditorBlockOccurrence | null, next: EditorBlockOccurrence | null): boolean {
  if (!previous || !next) return previous === next;
  const a = previous.fragment, b = next.fragment;
  return a.sourceDocument === b.sourceDocument && a.occurrenceId === b.occurrenceId && a.geometryVersion === b.geometryVersion
    && a.rect.x === b.rect.x && a.rect.y === b.rect.y && a.rect.width === b.rect.width && a.rect.height === b.rect.height;
}

import { resolveViewCoordinateAuthority, type QuireLayoutNode, type QuireLayoutSnapshot } from "@quirekit/view-engine";
import { projectEditorUIAnchorGeometry } from "./projection";
import { resolveEditorUIAnchorGeometry } from "./resolver";
import type { EditorUIAnchorRect, EditorUIAnchorSurfaceClientRect } from "./types";

/** Committed frame a passive range query reads: the layout and interaction snapshots of one render. */
export interface EditorUIRangeFrame {
  /** Layout snapshot; only its document identity is checked. */
  readonly layoutSnapshot: { readonly state: { readonly pm: { readonly doc: unknown } } };
  /** Interaction snapshot holding the retained geometry. */
  readonly interactionSnapshot: QuireLayoutSnapshot;
}

/** Mounted surface projection of one frame. */
export interface EditorUIRangeSurface {
  /** Surface rectangle in client CSS pixels. */
  readonly clientRect: EditorUIAnchorSurfaceClientRect;
  /** Document-space bounds the surface shows. */
  readonly surfaceBounds?: EditorUIAnchorRect | undefined;
}

/**
 * @param frame - Committed frame, or undefined before the first render.
 * @param range - Half-open canonical range.
 * @param sourceDocument - Exact source identity the caller resolved its range against.
 * @returns The interaction snapshot when the frame shows that document and the range is valid there, otherwise null.
 */
function matchingSnapshot(frame: EditorUIRangeFrame | undefined, range: { readonly from: number; readonly to: number },
  sourceDocument: QuireLayoutSnapshot["state"]["pm"]["doc"]): QuireLayoutSnapshot | null {
  if (!frame || frame.layoutSnapshot.state.pm.doc !== sourceDocument || frame.interactionSnapshot.state.pm.doc !== sourceDocument
    || !Number.isInteger(range.from) || !Number.isInteger(range.to)
    || range.from < 0 || range.to > sourceDocument.content.size || range.from >= range.to) return null;
  return frame.interactionSnapshot;
}

/**
 * Reads the visual line bands of an explicit range from retained text
 * products, without borrowing the local caret's Story or occurrence owner.
 *
 * @param frame - Committed frame; local selection context is not read.
 * @param surface - Surface projection, which alone converts document to client pixels, zoom included.
 * @param range - Half-open canonical range.
 * @param sourceDocument - Exact source identity against which the caller resolved its range.
 * @returns Separate client-space line bands, or null before matching geometry exists.
 */
export function resolveEditorUITextRangeRects(frame: EditorUIRangeFrame | undefined, surface: EditorUIRangeSurface,
  range: { readonly from: number; readonly to: number }, sourceDocument: QuireLayoutSnapshot["state"]["pm"]["doc"]): readonly EditorUIAnchorRect[] | null {
  const snapshot = matchingSnapshot(frame, range, sourceDocument), version = snapshot?.viewGraph?.version;
  if (!snapshot || version === undefined) return null;
  const geometry = resolveEditorUIAnchorGeometry({ snapshot, request: { kind: "text", range, expectedSnapshotVersion: version } });
  const projected = projectEditorUIAnchorGeometry({ geometry, surfaceClientRect: surface.clientRect, surfaceBounds: surface.surfaceBounds });
  return projected.status === "ready" ? projected.rects : null;
}

/**
 * Reads the boxes of the structured targets inside an explicit range: every
 * table cell fragment whose source lies in it, one box per page a cell spans.
 * Remote cell selections draw these, so they look like the local one.
 *
 * @param frame - Committed frame; local selection context is not read.
 * @param surface - Surface projection, which alone converts document to client pixels, zoom included.
 * @param range - Half-open canonical range.
 * @param sourceDocument - Exact source identity against which the caller resolved its range.
 * @returns Client-space boxes, empty when the range holds no structured target, or null before matching geometry exists.
 */
export function resolveEditorUIStructuredRangeRects(frame: EditorUIRangeFrame | undefined, surface: EditorUIRangeSurface,
  range: { readonly from: number; readonly to: number }, sourceDocument: QuireLayoutSnapshot["state"]["pm"]["doc"]): readonly EditorUIAnchorRect[] | null {
  const snapshot = matchingSnapshot(frame, range, sourceDocument), client = surface.clientRect;
  if (!snapshot || !(client.width > 0 && client.height > 0) || surface.surfaceBounds === undefined) return null;
  const boxes: EditorUIAnchorRect[] = [];
  /** @param nodes - Layout nodes to search in document order. */
  const visit = (nodes: readonly QuireLayoutNode[]): void => {
    for (const node of nodes) {
      if (node.table) {
        for (const cell of node.table.cells) if (cell.range.from >= range.from && cell.range.to <= range.to) boxes.push(cell.rect);
      } else if (node.children) visit(node.children);
    }
  };
  visit(snapshot.root.children ?? []);
  const authority = resolveViewCoordinateAuthority(client, surface.surfaceBounds);
  return boxes.map((box) => {
    const mapped = authority.documentToClientRect(box).to;
    return { x: mapped.x, y: mapped.y, width: mapped.width, height: mapped.height };
  });
}

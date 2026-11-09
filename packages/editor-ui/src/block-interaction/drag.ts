import type { QuireEditor } from "@quirekit/core";
import { holdQuireDragCursor } from "@quirekit/ui";
import { DragSession } from "../drag";
import { NodeRangeSelection } from "../node-range-selection";
import { readBlockCatalog, resolveBlockRange, type BlockRangeRef, type BlockSlotRef } from "@quirekit/extensions";
import { queryEditorBlockOccurrences } from "./query";
import type { EditorBlockDragPreview, EditorBlockOccurrence } from "./types";

/**
 * Connects semantic drag intents to one exclusive mounted pointer lease.
 * @param editor - Canonical command owner.
 * @param root - Product clipping/drop-zone owner.
 * @param event - Handle pointer press.
 * @param source - Captured structural membership.
 * @param initial - Initial exact occurrence.
 * @param preview - Updates ghost and indicator only.
 * @param clicked - Opens the menu when the threshold was never crossed.
 * @returns Idempotent cancellation or null if mounting rejected the lease.
 */
export function startEditorBlockDrag(editor: QuireEditor, root: HTMLElement, event: PointerEvent, source: BlockRangeRef, initial: EditorBlockOccurrence, preview: (value: EditorBlockDragPreview | null) => void, clicked: () => void): (() => void) | null {
  const catalog = readBlockCatalog(editor);
  const blocks = catalog && resolveBlockRange(catalog, source);
  if (!catalog || !blocks?.length) return null;
  const text = blocks[0]!.node.textBetween(0, Math.min(blocks[0]!.node.content.size, 120), " ").trim();
  const nodes = blocks.map(block => ({ identity: { rootId: block.rootId, nodeId: block.blockId }, order: block.order, range: { from: block.from, to: block.to } }));
  /** @param version - Geometry version. @returns Versioned structural source facts. */
  const selectionAt = (version: number) => NodeRangeSelection.create({ snapshotVersion: version, writingDirection: "ltr", nodes, anchor: { rootId: source.anchor.rootId, nodeId: source.anchor.blockId }, focus: { rootId: source.focus.rootId, nodeId: source.focus.blockId } });
  const selection = selectionAt(initial.fragment.geometryVersion);
  if (selection.status !== "ready") return null;
  let latest: readonly EditorBlockOccurrence[] = [];
  let line: EditorBlockDragPreview["line"] = null;
  let version = initial.fragment.geometryVersion;
  const admission = new Map<string, boolean>();
  let releaseCursor: (() => void) | null = null;
  /** Restores hover cursors once the block is no longer being carried. */
  const endCursor = (): void => { releaseCursor?.(); releaseCursor = null; };
  const session = new DragSession<BlockRangeRef, BlockSlotRef>({
    threshold: 5,
    resolveTarget: ({ update }) => {
      let best: { occurrence: EditorBlockOccurrence; side: "before" | "after"; y: number; distance: number } | null = null;
      for (const occurrence of latest) {
        if (occurrence.block.scopeId !== source.anchor.scopeId) continue;
        const { rect, first, last } = occurrence.fragment;
        for (const side of ["before", "after"] as const) {
          if ((side === "before" && !first) || (side === "after" && !last)) continue;
          const y = rect.y + (side === "after" ? rect.height : 0);
          const distance = Math.abs(update.clientPoint.y - y);
          if (!best || distance < best.distance) best = { occurrence, side, y, distance };
        }
      }
      line = null;
      if (!best) return { status: "rejected", reason: "no-target" };
      const destination: BlockSlotRef = { target: best.occurrence.block, side: best.side, expectedDocumentRevision: catalog.revision };
      const key = `${destination.target.blockId}:${destination.side}`;
      let allowed = admission.get(key);
      if (allowed === undefined) { allowed = editor.can().moveBlockRange({ source, destination }); admission.set(key, allowed); }
      if (!allowed) return { status: "rejected", reason: "permission-denied" };
      const fragment = best.occurrence.fragment;
      line = { x: fragment.rect.x, y: best.y, width: fragment.rect.width };
      return { status: "ready", snapshotVersion: version, identity: { rootId: destination.target.rootId, nodeId: destination.target.blockId }, placement: best.side, payload: destination,
        indicator: { kind: "line", coordinateSpace: "document", snapshotVersion: version, placement: best.side, rect: { ...fragment.documentRect, y: fragment.documentRect.y + (best.side === "after" ? fragment.documentRect.height : 0), height: 2 }, sourceTargetIds: [fragment.occurrenceId] } };
    }
  });
  session.arm({ pointerId: event.pointerId, pressClientPoint: { x: event.clientX, y: event.clientY }, source: { selection: selection.selection, payload: source } });
  const cancel = editor.view.beginBlockDrag?.(event, {
    update(point) {
      const boundary = root.getBoundingClientRect();
      const inside = point.clientX >= boundary.left && point.clientX <= boundary.right && point.clientY >= boundary.top && point.clientY <= boundary.bottom;
      latest = queryEditorBlockOccurrences(editor, point.clientY);
      const nextVersion = latest[0]?.fragment.geometryVersion ?? version;
      if (nextVersion !== version) { version = nextVersion; session.remapSource(selectionAt(version)); }
      const result = session.update({ pointerId: event.pointerId, clientPoint: { x: point.clientX, y: point.clientY }, snapshotVersion: version, insideDropZone: inside, autoScroll: { kind: "idle" } });
      if (result.status === "targeting") {
        releaseCursor ??= holdQuireDragCursor(root.ownerDocument);
        preview({ pointer: { x: point.clientX, y: point.clientY }, x: point.clientX + 14, y: point.clientY + 12, count: blocks.length, text, line });
      } else { endCursor(); preview(null); }
      return result.status === "cancelled" || result.status === "ignored" ? null : result.status === "targeting";
    },
    finish() {
      endCursor();
      const wasClick = session.state.phase === "armed";
      const result = session.drop({ pointerId: event.pointerId, snapshotVersion: version });
      preview(null);
      if (wasClick) clicked();
      else if (result.status === "committed") editor.commands.moveBlockRange({ source: result.intent.source.payload, destination: result.intent.target.payload });
    },
    cancel() { endCursor(); session.cancel("pointer-cancel"); preview(null); }
  });
  return cancel ?? null;
}

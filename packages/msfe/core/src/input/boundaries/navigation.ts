import { EditorSelection, Prec, type SelectionRange } from "@quirekit/cm-state";
import { Direction, keymap, type EditorView } from "@quirekit/cm-view";
import { readSourcePresentation } from "../../presentation/state";
import { isSourceRevealed } from "../../presentation/activation/range";
import { boundariesAt, editingBoundaryRules, editingBoundarySources } from "./registry";
import { editingCursor } from "./selection";

/** @param view - Native geometry owner. @param range - Caret. @returns Its painted point in the layout before the key press, or null when unmounted. */
function point(view: EditorView, range: SelectionRange): string | null {
  const coords = view.coordsAtPos(range.head, range.assoc || 1);
  return coords ? `${Math.round(coords.left)},${Math.round(coords.top)}` : null;
}

/**
 * Every key press moves the visible caret: a candidate painted at the caret's current point is
 * hidden source, so motion continues in the same direction until the point changes or the
 * document edge stops it. Geometry is read from the layout before the press, so a reveal
 * caused by the move cannot redirect it.
 * A candidate at a row break, such as after `<br>`, is first tried on the side it moves toward.
 * @param view - Native geometry owner. @param range - Caret before the press. @param next - Normalized candidate.
 * @param step - One further native motion from a candidate. @param side - Association toward the motion, or 0 for vertical motion.
 * @returns The first candidate painted elsewhere.
 */
function visible(view: EditorView, range: SelectionRange, next: SelectionRange, step: (from: SelectionRange) => SelectionRange, side: -1 | 0 | 1): SelectionRange {
  const start = point(view, range), seen = new Set<number>([range.head]);
  while (start !== null && point(view, next) === start && !seen.has(next.head)) {
    const flipped = side && next.assoc !== side ? EditorSelection.cursor(next.head, side, next.bidiLevel ?? undefined, next.goalColumn) : null;
    if (flipped && point(view, flipped) !== start) return flipped;
    seen.add(next.head);
    const moved = step(next);
    if (moved.head === next.head) break;
    next = moved;
  }
  return next;
}

/**
 * Live preview hides block syntax rows, such as code fences, until the caret enters their block, so native motion
 * passes over them. A skipped row that the caret would reveal is a stop: its start moving forward, its end moving back.
 * @param view - Native geometry owner. @param range - Caret before the press. @param next - Candidate. @param forward - Logical direction.
 * @returns The edge of the first such row between them, or the candidate.
 */
function revealStop(view: EditorView, range: SelectionRange, next: SelectionRange, forward: boolean): SelectionRange {
  const { doc } = view.state, from = doc.lineAt(range.head).number, to = doc.lineAt(next.head).number;
  for (let number = from + (forward ? 1 : -1); forward ? number < to : number > to; number += forward ? 1 : -1) {
    const line = doc.line(number);
    if (!/\S/u.test(line.text) || isSourceRevealed(view.state, line)) continue;
    const edge = forward ? line.from : line.to;
    if (isSourceRevealed(view.state.update({ selection: EditorSelection.cursor(edge) }).state, line)) return EditorSelection.cursor(edge, forward ? 1 : -1);
  }
  return next;
}

/** @param view - Native geometry owner. @param range - Current caret. @param next - Already measured native candidate. @param forward - Logical direction. @returns First real vertical line beyond a declared block shell. */
function vertical(view: EditorView, range: SelectionRange, next: SelectionRange, forward: boolean): SelectionRange {
  const seen = new Set<number>([range.head]);
  while (!seen.has(next.head) && boundariesAt(view.state, next.head).some(value => value.kind === "block"
    && (next.head < value.contentFrom || next.head > value.contentTo) || value.kind === "syntax"
    && view.state.doc.lineAt(value.from).from === value.from && view.state.doc.lineAt(value.to).to === value.to)) {
    seen.add(next.head);
    const moved = view.moveVertically(next, forward);
    if (moved.head === next.head) break;
    next = moved;
  }
  return editingCursor(view.state, next, forward ? 1 : -1);
}

/** @param view - Native geometry owner. @param range - Collapsed range. @param next - Already measured native candidate. @param right - Visual direction. @returns A distinct native character stop after hidden style or block boundaries. */
function horizontal(view: EditorView, range: SelectionRange, next: SelectionRange, right: boolean): SelectionRange {
  const forward = right === (view.textDirectionAt(range.head) === Direction.LTR);
  const seen = new Set<number>([range.head]);
  for (;;) {
    const normalized = editingCursor(view.state, next, forward ? 1 : -1);
    const hiddenStep = boundariesAt(view.state, range.head).some(value => value.kind === "syntax"
      && range.head >= value.from && range.head <= value.to && normalized.head >= value.from && normalized.head <= value.to);
    if (normalized.head !== range.head && !hiddenStep || seen.has(next.head)) return normalized;
    // A content-first style maps its outside mark back to the same insertion.
    // Consume that hidden duplicate while native movement retains graphemes/BiDi.
    seen.add(next.head);
    next = view.moveByChar(next, forward);
  }
}

/**
 * Commits a normalized selection as the module's single view write.
 * @param view - Editor view.
 * @param ranges - Normalized ranges.
 * @param mainIndex - Main range index.
 * @returns Always true, so key bindings stop native handling.
 */
function select(view: EditorView, ranges: readonly SelectionRange[], mainIndex: number): boolean {
  view.dispatch({ selection: EditorSelection.create(ranges, mainIndex), userEvent: "select", scrollIntoView: true });
  return true;
}

/** @param axis - Native motion family. @param forward - Visual right/down. @param extend - Preserve the selection anchor. @returns Shared navigation only when semantic normalization changes the native result. */
function move(axis: "horizontal" | "vertical", forward: boolean, extend = false) {
  return (view: EditorView): boolean => {
    const presentation = readSourcePresentation(view.state), selection = view.state.selection;
    if (!(view.state.facet(editingBoundaryRules).size || view.state.facet(editingBoundarySources).length) || presentation.mode !== "live" || presentation.composing || presentation.selecting
      || !extend && selection.ranges.some(range => !range.empty)) return false;
    let changed = false;
    const ranges = selection.ranges.map(range => {
      const caret = EditorSelection.cursor(range.head, range.assoc, range.bidiLevel ?? undefined, range.goalColumn);
      const logical = forward === (view.textDirectionAt(caret.head) === Direction.LTR);
      const native = axis === "vertical" ? view.moveVertically(caret, forward) : view.moveByChar(caret, logical);
      const semantic = axis === "vertical" ? vertical(view, caret, native, forward) : horizontal(view, caret, native, forward);
      const shown = visible(view, caret, semantic, from => axis === "vertical"
        ? vertical(view, from, view.moveVertically(from, forward), forward)
        : horizontal(view, from, view.moveByChar(from, logical), forward), axis === "vertical" ? 0 : logical ? 1 : -1);
      const next = presentation.reveal === "hidden" ? shown : revealStop(view, caret, shown, axis === "vertical" ? forward : logical);
      if (!next.eq(native, true)) changed = true;
      return extend ? EditorSelection.range(range.anchor, next.head, next.goalColumn, next.bidiLevel ?? undefined) : next;
    });
    return changed && select(view, ranges, selection.mainIndex);
  };
}

/** @param extend - Preserve the selection anchor. @returns Line-end motion that lands after a style closing the line, which native geometry reports inside it. */
function lineEnd(extend = false) {
  return (view: EditorView): boolean => {
    const presentation = readSourcePresentation(view.state), selection = view.state.selection;
    if (presentation.mode !== "live" || presentation.composing || presentation.selecting) return false;
    let changed = false;
    const ranges = selection.ranges.map(range => {
      const native = view.moveToLineBoundary(EditorSelection.cursor(range.head, range.assoc), true);
      const next = editingCursor(view.state, native, 1, true, true);
      if (next.head !== native.head) changed = true;
      return extend ? EditorSelection.range(range.anchor, next.head) : next;
    });
    return changed && select(view, ranges, selection.mainIndex);
  };
}

/** Geometry stays native; a single adapter covers all registered block and style owners. */
export const boundaryNavigation = Prec.high(keymap.of([
  { key: "End", run: lineEnd(), shift: lineEnd(true) },
  { mac: "Mod-ArrowRight", run: lineEnd(), shift: lineEnd(true) },
  { key: "ArrowLeft", run: move("horizontal", false), shift: move("horizontal", false, true) },
  { key: "ArrowRight", run: move("horizontal", true), shift: move("horizontal", true, true) },
  { key: "ArrowUp", run: move("vertical", false), shift: move("vertical", false, true) },
  { key: "ArrowDown", run: move("vertical", true), shift: move("vertical", true, true) },
]));

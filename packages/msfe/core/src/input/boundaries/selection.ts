import { EditorSelection, type EditorState, type SelectionRange, type Transaction } from "@quirekit/cm-state";
import { readSourcePresentation } from "../../presentation/state";
import { boundariesActive, boundariesAt } from "./registry";
import type { EditingBoundary } from "./types";

/** @param state - Source owner. @param boundary - Block shell. @param forward - Exterior direction. @returns Neighboring real source edge, or the interior when no exterior exists. */
export function outsideBlock(state: EditorState, boundary: EditingBoundary, forward: boolean): number {
  const line = state.doc.lineAt(forward ? boundary.to : boundary.from);
  return forward ? line.to < state.doc.length ? line.to + 1 : boundary.contentTo
    : line.from > 0 ? line.from - 1 : boundary.contentFrom;
}

/** @param state - Source authority. @param from - Style start. @param to - Style end.
 * @returns Whether the style ends its line, or only the hidden closers of enclosing styles that end it follow it. */
export function closesStyleLine(state: EditorState, from: number, to: number): boolean {
  if (to === state.doc.lineAt(to).to) return true;
  return boundariesAt(state, to).some(outer => outer.kind === "style" && outer.navigation !== "split"
    && outer.from <= from && outer.to > to && to >= outer.contentTo && closesStyleLine(state, outer.from, outer.to));
}

/** @param state - Source authority. @param range - Candidate caret. @param direction - Requested logical movement, or zero for a direct placement. @param styles - Collapsed carets normalize style stops; nonempty selections retain their exact markup coverage.
 * @param arriving - The caret was moved or placed here without an edit, so it may stop after a style that closes its line.
 * @param typed - Text was just typed or pasted at the caret; finishing a style there leaves the caret after it.
 * @returns A legal source endpoint retaining native association and vertical goal. */
export function editingCursor(state: EditorState, range: SelectionRange, direction: -1 | 0 | 1 = 0, styles = true, arriving = false,
  typed = false): SelectionRange {
  if (!boundariesActive(state)) return range;
  let position = range.head, assoc = range.assoc;
  const visited = new Set<string>();
  for (;;) {
    let changed = false;
    for (const boundary of boundariesAt(state, position)) {
      const { from, to, contentFrom, contentTo, kind } = boundary;
      const key = `${kind}/${from}/${to}/${position}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const previous = position;
      if (kind === "separator") {
        if (position > from && position < to) position = direction < 0 ? from : to;
      } else if (kind === "atom" || kind === "syntax") {
        if (position > from && position < to) position = direction < 0 ? from : to;
      } else if (kind === "block") {
        const clamp = boundary.navigation === "content";
        if (position < contentFrom) position = direction < 0 && !clamp ? outsideBlock(state, boundary, false) : contentFrom;
        else if (position > contentTo) position = direction > 0 && !clamp ? outsideBlock(state, boundary, true) : contentTo;
        if (position === contentFrom) assoc = 1;
        else if (position === contentTo) assoc = -1;
      } else if (kind === "prefix") {
        if (position < contentFrom) position = contentFrom;
      } else if (styles && !readSourcePresentation(state).selecting && (position <= contentFrom || position >= contentTo)) {
        // A style closing its line keeps a stop at the line end, after its own and any enclosing hidden closers, reached by
        // moving right or clicking the line end, so typing or Enter there stays outside; moving left enters the style again.
        const end = state.doc.lineAt(to).to;
        const closesLine = boundary.navigation !== "split" && position >= contentTo && closesStyleLine(state, from, to);
        if (closesLine && (position === end || arriving && direction >= 0)) position = end;
        else if (typed && position === to && boundary.navigation !== "split") position = to;
        else if (boundary.navigation !== "split") position = position <= contentFrom ? contentFrom : contentTo;
        else if (position > from && position < contentFrom) position = direction < 0 ? from : contentFrom;
        else if (position > contentTo && position < to) position = direction > 0 ? to : contentTo;
        assoc = position === from ? -1 : position === to ? 1 : position <= contentFrom ? 1 : -1;
      }
      if (position !== previous) {
        // A block's visible content owns its edge geometry; associating with the
        // hidden shell would draw a table caret at the far border of the cell.
        if (kind !== "block" || position !== contentFrom && position !== contentTo) assoc = position < previous ? 1 : -1;
        changed = true; break;
      }
    }
    if (!changed) break;
  }
  return position === range.head && assoc === range.assoc ? range
    : EditorSelection.cursor(position, assoc, range.bidiLevel ?? undefined, range.goalColumn);
}

/** User event of a format toggle that stops a style and leaves the caret after its closer. */
export const STYLE_EXIT = "select.style-exit";

/** @param transaction - Current native candidate. @returns Corrected endpoints, or null when already legal. */
export function editingSelection(transaction: Transaction): EditorSelection | null {
  const state = transaction.state, selection = state.selection;
  if (!boundariesActive(state) || transaction.isUserEvent(STYLE_EXIT)) return null;
  const navigation = transaction.isUserEvent("select") && !transaction.isUserEvent("select.pointer");
  const ranges = selection.ranges.map((range, index) => {
    if (range.empty) {
      const previous = transaction.startState.selection.ranges[index]?.head ?? range.head;
      const separator = boundariesAt(state, range.head).some(value => value.kind === "separator");
      const direction = !transaction.docChanged && (navigation || separator) ? Math.sign(range.head - previous) as -1 | 0 | 1 : 0;
      // A pointer gesture normalizes only when it ends, after the caret already moved there.
      const released = readSourcePresentation(transaction.startState).selecting && !readSourcePresentation(state).selecting;
      const arriving = !transaction.docChanged && (range.head !== previous && transaction.isUserEvent("select") || released);
      let typed = false;
      if (transaction.isUserEvent("input.type") || transaction.isUserEvent("input.paste")) {
        transaction.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => { typed ||= fromB < range.head && range.head <= toB; });
      }
      return editingCursor(state, range, direction, true, arriving, typed);
    }
    // A fully selected owner remains removable, including select-all. Partial
    // endpoints are normalized without reversing or collapsing the selection.
    // A prefix block counts as selected only when the selection also reaches past its line; a selection of just
    // its line, as Shift+Home makes, selects its text so deleting it keeps the heading or list item.
    const covers = (value: EditingBoundary) => range.from <= (value.selectFrom ?? value.from) && range.to >= (value.selectTo ?? value.to)
      && (value.kind !== "prefix" || range.from < state.doc.lineAt(value.from).from || range.to > state.doc.lineAt(value.to).to);
    const endpoint = (position: number, side: -1 | 1): number => {
      if (boundariesAt(state, position).some(covers)) return position;
      return editingCursor(state, EditorSelection.cursor(position), side, false).head;
    };
    const from = endpoint(range.from, -1), to = endpoint(range.to, 1);
    return from === range.from && to === range.to ? range : EditorSelection.range(range.anchor === range.from ? from : to, range.head === range.to ? to : from);
  });
  return ranges.every((range, index) => range === selection.ranges[index]) ? null : EditorSelection.create(ranges, selection.mainIndex);
}

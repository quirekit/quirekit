import { EditorSelection } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { EditorView } from "@quirekit/cm-view";
import { STYLE_EXIT } from "@quirekit/msfe-core";
import { deleteBlockEdgeBackward } from "./blocks";
import { deleteListMarkupBackward } from "../list";
import { unwrapQuoteLine } from "../quote";
import { documentInput } from "../paragraph";

/** @param view - Editor. @returns The start of an inline style whose text starts at the caret and which itself starts a block's text, or null. */
function styleAtBlockStart(view: EditorView): number | null {
  const state = view.state, { main } = state.selection;
  // Only where markers are hidden; with source revealed, Backspace deletes the visible marker character.
  if (!documentInput(state) || state.selection.ranges.length !== 1 || !main.empty) return null;
  let start: number | null = null, edge = main.head;
  // Styles nested at one position open in a run of hidden markers; the outermost opener is the visible start.
  for (let node = syntaxTree(state).resolveInner(main.head, -1); node.parent; node = node.parent) {
    const opener = node.firstChild;
    if (opener && opener.name.endsWith("Mark") && opener.to === edge && node.from < edge) { start = node.from; edge = node.from; }
  }
  if (start === null) return null;
  const line = state.doc.lineAt(start), before = state.sliceDoc(line.from, start);
  return /^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|#{1,6}\s+)?$/u.test(before) ? start : null;
}

/**
 * Backspace with the caret at the text start of a style that starts a block's
 * text acts at the block's text start, as rich editors do: a list item peels,
 * a heading or quote becomes a paragraph, and the style stays.
 * @param view - Editor.
 * @returns Whether the key was handled.
 */
export function backspaceBeforeStyle(view: EditorView): boolean {
  const from = styleAtBlockStart(view);
  if (from === null) return false;
  const state = view.state, line = state.doc.lineAt(from), at = state.update({ selection: EditorSelection.cursor(from), filter: false }).state;
  const spec = deleteListMarkupBackward(at) ?? unwrapQuoteLine(at) ?? deleteBlockEdgeBackward(at);
  if (spec) { view.dispatch(spec); return true; }
  // A heading or first quote line loses its prefix through the shared prefix deletion.
  if (from === line.from) return false;
  view.dispatch({ selection: EditorSelection.cursor(from), userEvent: STYLE_EXIT });
  view.dispatch({ changes: { from: from - 1, to: from }, userEvent: "delete.backward" });
  return true;
}

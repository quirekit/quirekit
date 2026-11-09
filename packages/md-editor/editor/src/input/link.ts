import { EditorSelection, Prec } from "@quirekit/cm-state";
import { EditorView } from "@quirekit/cm-view";
import { proseInput } from "./paragraph";

/**
 * `(` typed right after a bracketed label opens a link destination without an
 * automatic `)`: the link only forms, and hides its destination, once the
 * destination is complete and `)` is typed, as rich editors convert it.
 */
export const linkDestinationInput = Prec.highest(EditorView.inputHandler.of((view, from, to, text) => {
  if (text !== "(" || from !== to || view.composing || !proseInput(view.state) || view.state.selection.ranges.length !== 1) return false;
  const line = view.state.doc.lineAt(from);
  if (!/\[[^\]]+\]$/u.test(view.state.sliceDoc(line.from, from))) return false;
  view.dispatch({ changes: { from, insert: "(" }, selection: EditorSelection.cursor(from + 1), scrollIntoView: true, userEvent: "input.type" });
  return true;
}));

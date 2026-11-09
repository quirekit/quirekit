import { EditorSelection, Prec, type EditorState, type TransactionSpec } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import { EditorView, keymap } from "@quirekit/cm-view";
import { proseInput } from "./paragraph";

/** Text interval of one table cell between its pipes. */
interface CellText {
  /** Position after the opening pipe. */
  readonly from: number;
  /** Position of the closing pipe. */
  readonly to: number;
}

/** @param state - Source. @param head - Caret. @returns The table cell around the caret on a header or body row, or null. */
export function cellAt(state: EditorState, head: number): CellText | null {
  let node = syntaxTree(state).resolveInner(head, -1);
  while (node.parent && node.name !== "Table") node = node.parent;
  if (node.name !== "Table") return null;
  const line = state.doc.lineAt(head);
  if (/^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/u.test(line.text)) return null;
  const pipes: number[] = [];
  for (let index = 0; index < line.text.length; index++) {
    if (line.text[index] === "\\") index++;
    else if (line.text[index] === "|") pipes.push(line.from + index);
  }
  const before = pipes.filter(pipe => pipe < head).at(-1), after = pipes.find(pipe => pipe >= head);
  return before === undefined || after === undefined ? null : { from: before + 1, to: after };
}

/** @param state - Source. @returns The caret when one plain caret edits a table in the document presentations. */
function caret(state: EditorState): number | null {
  const { main } = state.selection;
  return proseInput(state) && state.selection.ranges.length === 1 && main.empty ? main.head : null;
}

/**
 * Backspace at the start and Delete at the end of a cell's text do nothing, as
 * in rich editors, instead of removing padding and then the cell's pipe.
 * @param state - Source. @param forward - Delete rather than Backspace.
 * @returns Whether the key reaches a cell edge and is consumed without an edit.
 */
export function atCellEdge(state: EditorState, forward: boolean): boolean {
  const head = caret(state), cell = head === null ? null : cellAt(state, head);
  if (!cell) return false;
  return !/\S/u.test(forward ? state.sliceDoc(head!, cell.to) : state.sliceDoc(cell.from, head!));
}

/**
 * Enter at the end of a paragraph that is one table header row, such as
 * `| a | b |`, adds the delimiter row and an empty body row, as other editors do.
 * @param state - Source-owned input draft.
 * @returns The new table, or null for other paragraphs.
 */
export function tableFromHeader(state: EditorState): TransactionSpec | null {
  const head = caret(state);
  if (head === null) return null;
  const line = state.doc.lineAt(head), paragraph = syntaxTree(state).resolveInner(head, -1);
  if (head !== line.to || paragraph.name !== "Paragraph" || paragraph.parent?.name !== "Document" || paragraph.from !== line.from || paragraph.to !== line.to) return null;
  const match = /^\|((?:[^|\n]*\|)+)\s*$/u.exec(line.text);
  if (!match) return null;
  const cells = match[1]!.split("|").length - 1;
  const delimiter = `|${" --- |".repeat(cells)}`, body = `|${"  |".repeat(cells)}`;
  return { changes: { from: line.to, insert: `\n${delimiter}\n${body}` }, selection: EditorSelection.cursor(line.to + delimiter.length + 4),
    scrollIntoView: true, userEvent: "input" };
}

/** Table cell editing that keeps the row structure: cell edges, literal pipes. */
export const tableCellInput = Prec.highest([
  keymap.of([{ key: "Backspace", run: view => atCellEdge(view.state, false) }, { key: "Delete", run: view => atCellEdge(view.state, true) }]),
  // A typed pipe is cell text; unescaped it would split the cell.
  EditorView.inputHandler.of((view, from, to, text) => {
    if (text !== "|" || from !== to || view.composing || !proseInput(view.state) || !cellAt(view.state, from) || view.state.sliceDoc(from - 1, from) === "\\") return false;
    view.dispatch({ changes: { from, insert: "\\|" }, selection: EditorSelection.cursor(from + 2), userEvent: "input.type" });
    return true;
  }),
]);

/**
 * Enter in a table cell breaks the line inside the cell, as rich editors do. A GFM cell holds one
 * source line, so the break is written as `<br>`; Tab in the last cell still adds a row.
 * @param state - Source draft.
 * @returns The break, or null outside cells and outside document input.
 */
export function breakInCell(state: EditorState): TransactionSpec | null {
  const { main } = state.selection;
  if (!proseInput(state) || state.selection.ranges.length !== 1 || !cellAt(state, main.from) || !cellAt(state, main.to)) return null;
  return { changes: { from: main.from, to: main.to, insert: "<br>" }, selection: EditorSelection.cursor(main.from + 4), scrollIntoView: true, userEvent: "input" };
}

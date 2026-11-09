import { EditorSelection } from "@quirekit/cm-state";
import { EditorView, ViewPlugin } from "@quirekit/cm-view";
import { readSourcePresentation } from "@quirekit/msfe-core";
import { closedBlocks, opaque, topBlock } from "./blocks";

/**
 * @param view - Mounted editor.
 * @returns The position of a paragraph to write in after the last block when that block cannot take
 * text at the document end, opening one when needed, or null when the document end already takes text.
 */
export function trailingParagraph(view: EditorView): { at: number; insert: string } | null {
  const state = view.state, end = state.doc.length, last = state.doc.line(state.doc.lines);
  // An existing empty last row after a block is already the place to write.
  if (!/\S/u.test(last.text) && state.doc.lines > 1) return null;
  const block = topBlock(state, end);
  if (!block || !(closedBlocks.has(block.name) || block.name === "HorizontalRule" || opaque(view, block))) return null;
  return { at: end, insert: "\n\n" };
}

/**
 * A click below the end of the document, in the editor or the empty area of
 * the element it is mounted in, writes at the end as rich editors do: after the
 * last block, in a new paragraph when that block is code, a table or a preview.
 * Source editing places the caret at the end.
 */
export const trailingClick = ViewPlugin.define(view => {
  const area = view.dom.parentElement ?? view.dom;
  /** @param event - Primary pointer press. */
  const press = (event: MouseEvent) => {
    if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || view.state.readOnly) return;
    if (!(event.target instanceof Node) || !area.contains(event.target)) return;
    // The last block's box, not the end position: a hidden closing row lies inside it.
    const last = view.contentDOM.lastElementChild;
    const bottom = last?.getBoundingClientRect().bottom ?? view.coordsAtPos(view.state.doc.length)?.bottom ?? Infinity;
    const content = view.contentDOM.getBoundingClientRect();
    if (event.clientY <= bottom || event.clientX < content.left || event.clientX > content.right) return;
    // Source editing only places the caret at the end; document presentations open a paragraph when needed.
    const trailing = readSourcePresentation(view.state).mode === "live" ? trailingParagraph(view) : null, end = view.state.doc.length;
    event.preventDefault();
    view.dispatch(trailing ? { changes: { from: trailing.at, insert: trailing.insert }, selection: EditorSelection.cursor(trailing.at + trailing.insert.length),
      scrollIntoView: true, userEvent: "input" } : { selection: EditorSelection.cursor(end), scrollIntoView: true, userEvent: "select.pointer" });
    view.focus();
  };
  area.addEventListener("mousedown", press, true);
  return { destroy: () => area.removeEventListener("mousedown", press, true) };
});

/**
 * ↓ on the last row of a code block, table, container or preview that ends the document
 * opens a paragraph after it, where the caret otherwise has nowhere to go.
 * @param view - Mounted editor.
 * @returns Whether the key opened or entered that paragraph.
 */
export function leaveLastBlock(view: EditorView): boolean {
  const { main } = view.state.selection;
  if (readSourcePresentation(view.state).mode !== "live" || view.state.readOnly || view.state.selection.ranges.length > 1 || !main.empty) return false;
  const trailing = trailingParagraph(view);
  if (!trailing) return false;
  const here = view.coordsAtPos(main.head), below = view.coordsAtPos(view.moveVertically(main, true).head);
  if (!here || !below || below.top > here.top + 1) return false;
  view.dispatch({ changes: { from: trailing.at, insert: trailing.insert }, selection: EditorSelection.cursor(trailing.at + trailing.insert.length),
    scrollIntoView: true, userEvent: "input" });
  return true;
}

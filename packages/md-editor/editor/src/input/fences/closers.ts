import { EditorSelection, type EditorState, type TransactionSpec } from "@quirekit/cm-state";
import type { EditorView } from "@quirekit/cm-view";
import { proseInput } from "../paragraph";
import { topBlock } from "../edges/blocks";

/**
 * Enter at the end of a container or display-math opener that has no closer
 * yet adds the closer, as typing a code fence does; an unclosed block would
 * otherwise take in the rest of the document.
 * @param state - Source-owned input draft.
 * @returns The closed block with the caret on its empty body line, or null.
 */
export function closeTypedBlock(state: EditorState): TransactionSpec | null {
  const { main } = state.selection;
  if (!proseInput(state) || state.selection.ranges.length !== 1 || !main.empty) return null;
  const line = state.doc.lineAt(main.head), block = topBlock(state, main.head);
  if (main.head !== line.to || !block || block.from !== line.from) return null;
  const closer = block.name === "CustomContainer" && /^:{3,}\s*\S/u.test(line.text) && block.getChildren("ContainerMark").length < 2 ? line.text.match(/^:+/u)![0]
    : block.name === "DisplayMath" && /^\$\$\s*$/u.test(line.text) && !/^\$\$\s*$/mu.test(state.sliceDoc(line.to + 1)) ? "$$" : null;
  if (!closer) return null;
  return { changes: { from: line.to, insert: `\n\n${closer}` }, selection: EditorSelection.cursor(line.to + 1), scrollIntoView: true, userEvent: "input" };
}

/** @param view - Editor that just closed a display-math block. @param from - Block start. Opens its formula editor, as double-clicking its preview does. */
export function editNewMath(view: EditorView, from: number): void {
  // The preview mounts with the next view update; wait for it before activating it.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const preview = Array.from(view.contentDOM.querySelectorAll<HTMLElement>(".msfe-preview-displayMath"))
      .find(element => { try { return Math.abs(view.posAtDOM(element) - from) <= 3; } catch { return false; } });
    if (!preview) return;
    const rect = preview.getBoundingClientRect(), init = { bubbles: true, button: 0, clientX: rect.left + 4, clientY: rect.top + 4 };
    preview.dispatchEvent(new PointerEvent("pointerdown", init));
    preview.dispatchEvent(new MouseEvent("dblclick", init));
  }));
}

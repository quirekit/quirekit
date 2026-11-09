import { ChangeSet, EditorSelection, type EditorState } from "@quirekit/cm-state";
import { EditorView, runScopeHandlers } from "@quirekit/cm-view";
import { createMdEditor } from "../../editor";
import { accidentalCode, blockNodesOf, preservedBlocks } from "./invariants";
import type { QualityCell, QualityInput, QualityResult, QualityViolation } from "./types";

/** A character no fixture contains, typed to prove the caret is writable. */
const PROBE = "㐀";

/**
 * happy-dom dispatches `selectionchange` synchronously while the editor writes its DOM selection,
 * which nests an update; browsers dispatch it as a task. Defer it once, as browsers do.
 */
function deferSelectionChange(): void {
  const prototype = Object.getPrototypeOf(document) as Document & { quirekitDeferred?: boolean };
  if (prototype.quirekitDeferred) return;
  const dispatch = prototype.dispatchEvent, deferred = new WeakSet<Event>();
  prototype.dispatchEvent = function (this: Document, event: Event) {
    // happy-dom routes the deferred dispatch through this method again; that pass must go through.
    if (event.type !== "selectionchange" || deferred.has(event)) return dispatch.call(this, event);
    deferred.add(event);
    setTimeout(() => dispatch.call(this, event));
    return true;
  };
  prototype.quirekitDeferred = true;
}

/** @param state - Current source. @returns The source with its caret marked. */
function marked(state: EditorState): string {
  const doc = state.doc.toString(), head = state.selection.main.head;
  return doc.slice(0, head) + "¦" + doc.slice(head);
}

/**
 * One change spanning everything that differs; edits in two places count the text between them as touched.
 * @param before - Earlier source. @param after - Later source.
 * @returns The minimal single-range change set from before to after.
 */
function difference(before: EditorState, after: EditorState): ChangeSet {
  const a = before.doc.toString(), b = after.doc.toString();
  let start = 0, end = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  return ChangeSet.of(a === b ? [] : [{ from: start, to: a.length - end, insert: b.slice(start, b.length - end) }], a.length);
}

/**
 * Types like the browser does: input handlers first, plain insertion otherwise.
 * @param view - Mounted editor. @param text - Typed text.
 */
function typeText(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main;
  const insert = () => view.state.update({ changes: { from, to, insert: text }, selection: EditorSelection.cursor(from + text.length),
    userEvent: "input.type" });
  if (view.state.facet(EditorView.inputHandler).some(handler => handler(view, from, to, text, insert))) return;
  view.dispatch(insert());
}

/** @param view - Mounted editor. @param input - Matrix input. @returns Whether a key handler or typing consumed it. */
function perform(view: EditorView, input: QualityInput): boolean {
  if (input === "type") { typeText(view, "字"); return true; }
  const [shift, key] = input.startsWith("Shift-") ? [true, input.slice(6)] : [false, input];
  return runScopeHandlers(view, new KeyboardEvent("keydown", { key, shiftKey: shift }), "editor");
}

/**
 * Runs one matrix cell in a fresh document-view editor and checks I1–I4.
 * @param cell - Document, caret and input.
 * @returns The resulting source and every broken invariant.
 */
export function runQualityCell(cell: QualityCell): QualityResult {
  deferSelectionChange();
  const parent = document.createElement("div");
  document.body.append(parent);
  const markdown = cell.source.replace("¦", "");
  const editor = createMdEditor({ parent, markdown });
  const view = EditorView.findFromDOM(editor.element)!;
  const violations: QualityViolation[] = [];
  let after = "";
  try {
    view.focus();
    view.dispatch({ selection: EditorSelection.cursor(cell.source.indexOf("¦")) });
    const before = view.state, head = before.selection.main.head;
    // Phase 1: the input itself must leave every untouched block and create no accidental structure.
    perform(view, cell.input);
    const done = view.state, changes = difference(before, done);
    after = marked(done);
    const items = blockNodesOf(before).filter(node => node.name.endsWith("ListItem"));
    const edited: { from: number; to: number }[] = [];
    changes.iterChangedRanges((from, to) => edited.push({ from, to }));
    // Strict overlap: removing the break between two items edits neither item's own text.
    const moved = [items.filter(node => node.from <= head && head <= node.to).at(-1),
      ...items.filter(node => edited.some(range => range.from < node.to && node.from < range.to && (range.from > node.from || range.to < node.to)))].filter(item => !!item);
    violations.push(...preservedBlocks(before, done, changes, undefined, moved), ...accidentalCode(before, done, changes));
    // Phase 2: one undo restores source and caret (I4); redo returns to the edited state.
    if (!done.doc.eq(before.doc)) {
      editor.undo();
      if (view.state.doc.toString() !== markdown || view.state.selection.main.head !== head) {
        violations.push({ rule: "I4", detail: `撤销后为 ${JSON.stringify(marked(view.state))}` });
      }
      editor.redo();
      view.dispatch({ selection: done.selection });
    }
    // Phase 3: text typed at the resulting caret is visible and changes no other block (I3).
    const ready = view.state;
    typeText(view, PROBE);
    const typed = view.state, typing = difference(ready, typed);
    if (!view.contentDOM.textContent?.includes(PROBE)) violations.push({ rule: "I3", detail: "继续输入的文字不可见" });
    violations.push(...preservedBlocks(ready, typed, typing, typed.selection.main.head).map(item => ({ rule: "I3" as const, detail: `继续输入后 ${item.detail}` })));
  } catch (error) {
    violations.push({ rule: "error", detail: String((error as Error).stack ?? error) });
  } finally {
    editor.destroy();
    parent.remove();
  }
  return { cell, after, violations };
}

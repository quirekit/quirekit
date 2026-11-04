import { EditorSelection, EditorState, type ChangeSpec, type Extension, type Transaction } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import { isSourceRevealed, readSourcePresentation } from "@quirekit/msfe-core";

/** Fence tokens of one fenced block that starts on a given line. */
interface FenceAt {
  /** Fenced block node. */
  readonly node: SyntaxNode;
  /** Opening fence token. */
  readonly open: SyntaxNode;
  /** Closing fence token, absent while the block runs to the end of its container. */
  readonly close: SyntaxNode | null;
}

/** @param state - Parsed source. @param pos - Position on the candidate opening line. @returns The fenced block opened on that line, or null. */
function fenceAt(state: EditorState, pos: number): FenceAt | null {
  const line = state.doc.lineAt(pos);
  for (const side of [-1, 1] as const) {
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side);
    while (node && node.name !== "FencedCode") node = node.parent;
    if (!node || node.from < line.from || node.from > line.to) continue;
    const [open, close] = node.getChildren("CodeMark");
    if (open) return { node, open, close: close ?? null };
  }
  return null;
}

/** @param state - Parsed source. @param node - Fenced block. @returns Container prefix for a new line of the block, list markers blanked to equal-width spaces. */
function closingPrefix(state: EditorState, node: SyntaxNode): string {
  const line = state.doc.lineAt(node.from);
  let prefix = state.sliceDoc(line.from, node.from);
  for (let parent = node.parent; parent; parent = parent.parent) {
    const mark = parent.name === "ListItem" ? parent.getChild("ListMark") : null;
    if (mark && mark.from >= line.from && mark.to <= node.from) {
      prefix = prefix.slice(0, mark.from - line.from) + " ".repeat(mark.to - mark.from) + prefix.slice(mark.to - line.from);
    }
  }
  return prefix;
}

/** One typed run of fence characters located in both documents. */
interface TypedFence {
  /** The typed `` ` `` or `~`. */
  readonly char: string;
  /** Number of characters in the typed run. */
  readonly count: number;
  /** Insertion position before the edit. */
  readonly from: number;
  /** Position after the inserted character. */
  readonly to: number;
}

/** @param transaction - One native text insertion. @returns The inserted run of one fence character, or null. */
function typedFenceChar(transaction: Transaction): TypedFence | null {
  let typed = null as TypedFence | null, count = 0;
  transaction.changes.iterChanges((fromA, toA, _fromB, toB, inserted) => {
    count++;
    const text = inserted.toString();
    if (fromA === toA && /^(?:`+|~+)$/u.test(text)) typed = { char: text[0]!, count: text.length, from: fromA, to: toB };
  });
  return count === 1 ? typed : null;
}

/** A follow-up edit in post-edit coordinates, with the caret it leaves. */
interface PairEdit {
  /** Edit applied after the native input. */
  readonly changes: ChangeSpec;
  /** Caret after the edit; the native caret when absent. */
  readonly head?: number;
}

/** @param transaction - Native typing. @returns Closing-fence edits keeping the typed opener paired. */
function pairTyped(transaction: Transaction): PairEdit | null {
  const typed = typedFenceChar(transaction);
  if (!typed) return null;
  // Confirm in the new parse that the keystroke grew an opening fence; a closing
  // fence of an earlier block resolves to a block that starts on another line.
  const state = transaction.state, fence = fenceAt(state, typed.to);
  if (!fence || typed.to - typed.count < fence.open.from || typed.to > fence.open.to) return null;
  const mark = state.sliceDoc(fence.open.from, fence.open.to);
  if (mark[0] !== typed.char) return null;
  const before = fenceAt(transaction.startState, typed.from);
  if (!before) {
    const line = state.doc.lineAt(typed.to);
    if (mark.length !== 3 || state.sliceDoc(fence.open.to, line.to).trim()) return null;
    const prefix = closingPrefix(state, fence.node);
    // With hidden fences an empty block is an atom the caret cannot enter, so the block opens with one body row.
    if (readSourcePresentation(state).mode === "live" && !isSourceRevealed(state, fence.node)) {
      return { changes: { from: line.to, insert: `\n${prefix}\n${prefix}${mark}` }, head: line.to + 1 + prefix.length };
    }
    return { changes: { from: line.to, insert: `\n${prefix}${mark}` } };
  }
  // Lengthening a balanced opener lengthens its equal closer so the block keeps its extent.
  const { open, close } = before, start = transaction.startState;
  const length = mark.length - typed.count;
  if (!close || open.to - open.from !== length || close.to - close.from !== length || start.sliceDoc(close.from, close.from + 1) !== typed.char) return null;
  return { changes: { from: transaction.changes.mapPos(close.to), insert: typed.char.repeat(typed.count) } };
}

/** @param transaction - Native Backspace/Delete. @returns Removal of an empty block's closer once its opener stops being a fence. */
function unpairDeleted(transaction: Transaction): PairEdit | null {
  const start = transaction.startState, head = start.selection.main.head;
  const fence = fenceAt(start, head);
  if (!fence?.close || start.doc.lineAt(fence.close.from).number !== start.doc.lineAt(fence.open.from).number + 1) return null;
  const length = fence.open.to - fence.open.from;
  let removed = 0, inside = true;
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    removed += toA - fromA;
    inside &&= fromA >= fence.open.from && toA <= fence.open.to && !inserted.length;
  });
  if (!inside || length - removed >= 3 || fence.node.getChild("CodeInfo")) return null;
  const opener = start.doc.lineAt(fence.open.from), closer = start.doc.lineAt(fence.close.from);
  return { changes: { from: transaction.changes.mapPos(opener.to), to: transaction.changes.mapPos(closer.to) } };
}

/**
 * Keeps typed fences balanced so a new opener never pairs with a later block's fence.
 * Runs inside the native transaction, so one undo restores the keystroke and its closer together.
 */
export const fencePairing: Extension = EditorState.transactionFilter.of(transaction => {
  const start = transaction.startState;
  if (!transaction.docChanged || start.readOnly || readSourcePresentation(start).composing || transaction.isUserEvent("input.type.compose")
    || start.selection.ranges.length !== 1 || transaction.newSelection.ranges.length !== 1) return transaction;
  const edit = transaction.isUserEvent("input.type") ? pairTyped(transaction)
    : transaction.isUserEvent("delete") ? unpairDeleted(transaction) : null;
  if (!edit) return transaction;
  const head = edit.head ?? transaction.newSelection.main.head;
  return [transaction, { changes: edit.changes, selection: EditorSelection.cursor(head), sequential: true }];
});

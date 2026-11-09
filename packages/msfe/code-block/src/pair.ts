import { ChangeSet, EditorSelection, EditorState, StateField, type ChangeSpec, type Extension, type Transaction } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import { isSourceRevealed, markChangeOrigin, readSourcePresentation } from "@quirekit/msfe-core";
import { fencedAt } from "./query";

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

/** @param changes - One native or composed text insertion. @returns The inserted run of one fence character, or null. */
function typedFenceChar(changes: ChangeSet): TypedFence | null {
  let typed = null as TypedFence | null, count = 0;
  changes.iterChanges((fromA, toA, _fromB, toB, inserted) => {
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
  /** Whether the edit repairs a hidden fence that editing boundaries otherwise protect. */
  readonly repair?: boolean;
}

/**
 * A fence typed on a body line closes its block early, which would turn the old closer into an opener that pairs with
 * the next block. Removes that closer when only blank lines follow the new one, or reopens the rest as its own block.
 * @param start - Source before the input. @param state - Source after it. @param changes - The input. @param typed - Typed run.
 * @returns The balancing edit in `state` coordinates, or null when the typed run did not close a block early.
 */
function closeTyped(start: EditorState, state: EditorState, changes: ChangeSet, typed: TypedFence): PairEdit | null {
  const block = fencedAt(start, typed.from), [open, close] = block?.getChildren("CodeMark") ?? [];
  if (!block || !open || !close || start.doc.lineAt(open.from).number === start.doc.lineAt(typed.from).number) return null;
  const line = state.doc.lineAt(typed.to), after = fenceAt(state, changes.mapPos(open.from));
  if (!after?.close || state.doc.lineAt(after.close.from).number !== line.number) return null;
  const old = state.doc.lineAt(changes.mapPos(close.from));
  if (old.number <= line.number) return null;
  // Blank continuation lines carry only quote markers or indentation.
  const between = state.sliceDoc(line.to, old.from);
  if (/^[\s>]*$/u.test(between)) return { changes: { from: line.to, to: old.to }, repair: true };
  return { changes: { from: line.to, insert: `\n${closingPrefix(state, after.node)}${state.sliceDoc(after.open.from, after.open.to)}` } };
}

/** @param start - Source before the input. @param state - Source after it. @param changes - Typed or IME-committed text.
 * @returns Closing-fence edits keeping the typed opener paired, in `state` coordinates. */
function pairTyped(start: EditorState, state: EditorState, changes: ChangeSet): PairEdit | null {
  const typed = typedFenceChar(changes);
  if (!typed) return null;
  const closing = closeTyped(start, state, changes, typed);
  if (closing) return closing;
  // Confirm in the new parse that the keystroke grew an opening fence; a closing
  // fence of an earlier block resolves to a block that starts on another line.
  const fence = fenceAt(state, typed.to);
  if (!fence || typed.to - typed.count < fence.open.from || typed.to > fence.open.to) return null;
  const mark = state.sliceDoc(fence.open.from, fence.open.to);
  if (mark[0] !== typed.char) return null;
  const before = fenceAt(start, typed.from);
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
  const { open, close } = before;
  const length = mark.length - typed.count;
  if (!close || open.to - open.from !== length || close.to - close.from !== length || start.sliceDoc(close.from, close.from + 1) !== typed.char) return null;
  return { changes: { from: changes.mapPos(close.to), insert: typed.char.repeat(typed.count) } };
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

/** Source before the running IME composition and the text it has changed so far. */
interface ComposedInput {
  /** State when the composition started. */
  readonly start: EditorState;
  /** All composition edits, in `start` coordinates. */
  readonly changes: ChangeSet;
}

/** Collects one composition, so a fence committed through an input method pairs once the composition ends. */
const composedInput = StateField.define<ComposedInput | null>({
  create: () => null,
  update(value, transaction) {
    if (!readSourcePresentation(transaction.state).composing) return null;
    const base = value ?? { start: transaction.startState, changes: ChangeSet.empty(transaction.startState.doc.length) };
    return transaction.docChanged ? { start: base.start, changes: base.changes.compose(transaction.changes) } : base;
  },
});

/** @param transaction - Any accepted edit. @returns The pairing edit for typing or deleting, or null while an input method still composes. */
function pairEdit(transaction: Transaction): PairEdit | null {
  const start = transaction.startState, state = transaction.state;
  if (readSourcePresentation(state).composing) return null;
  // Pairing during composition would rewrite DOM around the preedit, so a committed fence pairs when the composition ends.
  if (readSourcePresentation(start).composing) {
    const composed = start.field(composedInput, false);
    return composed ? pairTyped(composed.start, state, composed.changes.compose(transaction.changes)) : null;
  }
  if (!transaction.docChanged) return null;
  return transaction.isUserEvent("input.type") ? pairTyped(start, state, transaction.changes)
    : transaction.isUserEvent("delete") ? unpairDeleted(transaction) : null;
}

/**
 * Keeps typed fences balanced so a new opener never pairs with a later block's fence.
 * Runs inside the native transaction, so one undo restores the keystroke and its closer together.
 */
export const fencePairing: Extension = [composedInput, EditorState.transactionFilter.of(transaction => {
  const start = transaction.startState;
  if (start.readOnly || start.selection.ranges.length !== 1 || transaction.newSelection.ranges.length !== 1) return transaction;
  const edit = pairEdit(transaction);
  if (!edit) return transaction;
  const head = edit.head ?? transaction.newSelection.main.head;
  // A user origin lets editing boundaries accept the repair while change events still report direct input.
  return [transaction, { changes: edit.changes, selection: EditorSelection.cursor(head), sequential: true,
    ...(edit.repair ? markChangeOrigin("user")(transaction.state) : {}) }];
})];

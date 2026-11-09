import { EditorSelection, StateEffect, StateField, EditorState, type Extension, type Transaction } from "@quirekit/cm-state";
import { readSourcePresentation } from "../../presentation/state";

/** A marker pair a collapsed toggle inserted for the text typed next. */
interface PendingMark {
  /** Position between the two markers. */
  readonly at: number;
  /** One marker's spelling. */
  readonly marker: string;
}

/** Records the empty pair a collapsed format toggle just inserted. */
export const pendingMarkEffect = StateEffect.define<PendingMark>({ map: (value, mapping) => ({ ...value, at: mapping.mapPos(value.at, -1) }) });

/** The pending pair, dropped once text is typed into it or it is removed. */
const pendingMark = StateField.define<PendingMark | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(pendingMarkEffect)) return effect.value;
    if (!value) return null;
    const at = transaction.changes.mapPos(value.at, -1), length = value.marker.length;
    return transaction.state.sliceDoc(at - length, at + length) === value.marker + value.marker ? { ...value, at } : null;
  },
});

/** @param transaction - Candidate leaving or splitting the pair. @param mark - Pair in the start state. @returns The repair, or null to keep the pair. */
function repair(transaction: Transaction, mark: PendingMark): { from: number; to: number; head: number }[] | null {
  const state = transaction.state, length = mark.marker.length;
  const open = transaction.changes.mapPos(mark.at, -1), close = transaction.changes.mapPos(mark.at, 1);
  if (state.sliceDoc(open - length, open) !== mark.marker || state.sliceDoc(close, close + length) !== mark.marker) return null;
  const between = state.sliceDoc(open, close), head = transaction.newSelection.main.head;
  // Enter inside the pair splits the line without carrying the markers along.
  if (between && !/\S/u.test(between) && /\n/u.test(between)) return [{ from: open - length, to: open, head: head - length }, { from: close, to: close + length, head: head - length }];
  if (between || head === open) return null;
  // An arrow key still moves one character from where the caret visibly was.
  const origin = open - length, arrow = transaction.isUserEvent("select") && !transaction.isUserEvent("select.pointer");
  const after = head < origin ? head : head > close + length ? head - 2 * length : origin;
  const target = arrow ? Math.max(0, Math.min(state.doc.length - 2 * length, origin + Math.sign(head - open))) : after;
  return [{ from: origin, to: close + length, head: target }];
}

/**
 * An empty marker pair left by a collapsed toggle disappears once the caret
 * leaves it without typing, so moving away leaves no stray `****` in the source.
 */
export const pendingMarkCleanup: Extension = [pendingMark, EditorState.transactionFilter.of(transaction => {
  const mark = transaction.startState.field(pendingMark, false);
  if (!mark || transaction.effects.some(effect => effect.is(pendingMarkEffect)) || readSourcePresentation(transaction.state).selecting) return transaction;
  // A pointer gesture is judged when it is released, once the caret already moved.
  const released = readSourcePresentation(transaction.startState).selecting;
  if (!transaction.selection && !transaction.docChanged && !released) return transaction;
  const edits = repair(transaction, mark);
  if (!edits) return transaction;
  return [transaction, { changes: edits.map(({ from, to }) => ({ from, to })), selection: EditorSelection.cursor(edits[0]!.head), sequential: true }];
})];

/** @param state - Source before a toggle. @param at - Collapsed caret. @param marker - Format marker. @returns Whether the caret sits in an empty pair of that marker. */
export function inEmptyPair(state: EditorState, at: number, marker: string): boolean {
  return state.sliceDoc(at - marker.length, at + marker.length) === marker + marker;
}

import { ChangeSet, EditorSelection, EditorState, StateField, type Extension, type Transaction, type TransactionSpec } from "@quirekit/cm-state";
import { compositionEffect } from "../../state/fields";
import { boundariesActive, boundariesAt } from "./registry";

/** Caret and accumulated edits of the composition in progress. */
interface PendingComposition {
  /** Caret when the composition started. */
  readonly head: number;
  /** Every source change made while composing. */
  readonly changes: ChangeSet;
}

/** Tracks one composition from start to end so its committed text can be placed afterwards. */
const pendingComposition = StateField.define<PendingComposition | null>({
  create: () => null,
  /** @param value - Composition in progress. @param transaction - Accepted update. @returns Updated tracking. */
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(compositionEffect)) {
      return effect.value ? { head: transaction.state.selection.main.head, changes: ChangeSet.empty(transaction.state.doc.length) } : null;
    }
    return value && transaction.docChanged ? { head: value.head, changes: value.changes.compose(transaction.changes) } : value;
  },
});

/**
 * Firefox composes text typed after a style that closes its line inside the
 * style's text node. When the composition ends, move the committed text after
 * the closer, where the caret was when composing started.
 * @param transaction - Candidate update.
 * @returns The update followed by the relocation, or the update unchanged.
 */
function placeComposedText(transaction: Transaction): Transaction | readonly [Transaction, TransactionSpec] {
  const pending = transaction.startState.field(pendingComposition, false);
  if (!pending || !transaction.effects.some(effect => effect.is(compositionEffect) && !effect.value)) return transaction;
  const state = transaction.state;
  if (!boundariesActive(state) || transaction.docChanged) return transaction;
  let inserted: { from: number; to: number } | null = null, count = 0;
  pending.changes.iterChanges((fromA, toA, fromB, toB) => { count++; if (fromA === toA) inserted = { from: fromB, to: toB }; });
  const range = inserted as { from: number; to: number } | null;
  if (count !== 1 || !range || range.to === range.from) return transaction;
  const head = pending.changes.mapPos(pending.head, 1);
  const owner = boundariesAt(state, range.to).find(value => value.kind === "style" && value.contentTo === range.to
    && value.to === head && value.to === state.doc.lineAt(value.to).to);
  if (!owner || state.selection.main.head !== head) return transaction;
  const text = state.sliceDoc(range.from, range.to);
  return [transaction, { changes: [{ from: range.from, to: range.to }, { from: owner.to, insert: text }],
    selection: EditorSelection.cursor(owner.to, 1), sequential: true }];
}

/** Composition placement for styles that close their line. */
export const composedTextPlacement: Extension = [pendingComposition, EditorState.transactionFilter.of(placeComposedText)];

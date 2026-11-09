import { EditorState, Prec, Transaction, type Extension, type TransactionSpec } from "@quirekit/cm-state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@quirekit/cm-view";
import { boundaryInputCorrection } from "./changes";
import { boundaryNavigation } from "./navigation";
import { composedTextPlacement } from "./composition";
import { pendingMarkCleanup } from "../../commands/formatting/pending";
import { editingBoundaryRules } from "./registry";
import { editingSelection } from "./selection";
import type { EditingBoundaryRule } from "./types";

/** @param transaction - Native input, selection or presentation update. @param correction - Already planned edit, or null for selection-only acceptance. @returns One source edit and a legal visible selection without planning the edit twice. */
function accept(transaction: Transaction, correction: TransactionSpec | null): Transaction {
  const accepted = correction ? transaction.startState.update(correction, { filter: false }) : transaction;
  const selection = editingSelection(accepted);
  return selection ? transaction.startState.update(accepted, { selection, sequential: true, filter: false }) : accepted;
}

/** @param transaction - Candidate from any input or command path. @returns Shared semantic acceptance. */
function filter(transaction: Transaction): Transaction { return accept(transaction, boundaryInputCorrection(transaction)); }

/** Native DOM replacement can merge wrappers and report unselected suffix text as new input. */
const nativeReplacement = EditorView.domEventHandlers({
  /** @param event - Authoritative cancelable text intent. @param view - Current source selection owner. @returns Whether the shared planner accepted input before native DOM mutation. */
  beforeinput(event, view) {
    if (!event.cancelable || event.isComposing || event.inputType !== "insertText" || !event.data || view.state.readOnly
      || !view.state.selection.ranges.some(range => !range.empty)) return false;
    const transaction = view.state.update({ ...view.state.replaceSelection(event.data), userEvent: "input.type", scrollIntoView: true, filter: false });
    const correction = boundaryInputCorrection(transaction);
    if (!correction) return false;
    event.preventDefault();
    // The accepted source plan still passes through every host change/transaction
    // filter. Dispatching the unfiltered preview would bypass those contracts.
    view.dispatch(correction);
    return true;
  },
});

/** History/provider transactions may bypass CM filters; repair endpoints before paint, never their source. */
const restore = ViewPlugin.fromClass(class {
  private disposed = false;
  /** @param view - Mounted canonical input owner. */
  constructor(private readonly view: EditorView) { this.schedule(view.state.update({ selection: view.state.selection, filter: false })); }
  /** @param transaction - The accepted source event, with directional selection context. */
  schedule(transaction: Transaction): void {
    const selection = editingSelection(transaction), state = this.view.state;
    if (!selection) return;
    queueMicrotask(() => {
      if (!this.disposed && this.view.state === state) this.view.dispatch({ selection, annotations: Transaction.addToHistory.of(false) });
    });
  }
  /** @param update - Latest accepted update; unchanged effects add no follow-up work. */
  update(update: ViewUpdate): void {
    const transaction = update.transactions.at(-1);
    if (transaction) this.schedule(transaction);
  }
  /** Cancels queued work on document replacement or disposal. */
  destroy(): void { this.disposed = true; }
});

/** Shared instance identity prevents one input pipeline per feature/provider. */
export const editingBoundaryRuntime = [Prec.highest(EditorState.transactionFilter.of(filter)), Prec.high(nativeReplacement), boundaryNavigation, restore, composedTextPlacement, pendingMarkCleanup];

/** @param rules - Feature-owned syntax contracts, highest precedence first. @returns Shared navigation, input protection and endpoint recovery; duplicate installations reuse one runtime. */
export function editingBoundaries(rules: readonly EditingBoundaryRule[]): Extension {
  return rules.length ? [editingBoundaryRules.of(rules), editingBoundaryRuntime] : [];
}

import { RemoveMarkStep, type Transaction } from "@quirekit/pm";
import { Extension } from "../extension";
import { combineTransactionSteps, getChangedRanges } from "../helpers";

/** Options accepted by the Tiptap-compatible delete observer. */
export interface DeleteOptions {
  /** Whether delete events should be emitted asynchronously. */
  readonly async: boolean;
  /**
   * Skips delete-event emission for transactions that return true.
   *
   * @param transaction - Transaction being observed.
   * @returns Whether the transaction should be ignored.
   */
  readonly filterTransaction?: ((transaction: Transaction) => boolean) | undefined;
}

/** Tiptap-compatible extension that emits events for deleted nodes and marks. */
export const Delete = Extension.create<DeleteOptions>({
  name: "delete",

  /**
   * Creates default delete observer options.
   *
   * @returns Default delete observer options.
   */
  addOptions() {
    return {
      async: true
    };
  },

  /**
   * Observes update transactions and emits node or mark deletion payloads.
   *
   * @param context - Update lifecycle context containing transactions.
   */
  onUpdate({ transaction, appendedTransactions }) {
    const editor = this.editor;

    // Typing removes nothing; skipping it avoids replaying every step on the previous document.
    if (!editor || !transaction || !removesContent([transaction, ...appendedTransactions])) {
      return;
    }

    const callback = (): void => {
      if (
        this.options.filterTransaction?.(transaction) ||
        transaction.getMeta("y-sync$")
      ) {
        return;
      }

      const combinedTransform = combineTransactionSteps(transaction.before, [
        transaction,
        ...appendedTransactions
      ]);
      const changes = getChangedRanges(combinedTransform);

      for (const change of changes) {
        if (
          combinedTransform.mapping.mapResult(change.oldRange.from).deletedAfter &&
          combinedTransform.mapping.mapResult(change.oldRange.to).deletedBefore
        ) {
          combinedTransform.before.nodesBetween(
            change.oldRange.from,
            change.oldRange.to,
            (node, from) => {
              const to = from + node.nodeSize - 2;
              const isFullyWithinRange =
                change.oldRange.from <= from && to <= change.oldRange.to;

              editor.emit("delete", {
                type: "node",
                node,
                from,
                to,
                newFrom: combinedTransform.mapping.map(from),
                newTo: combinedTransform.mapping.map(to),
                deletedRange: change.oldRange,
                newRange: change.newRange,
                partial: !isFullyWithinRange,
                editor,
                transaction,
                combinedTransform
              });
            }
          );
        }
      }

      combinedTransform.steps.forEach((step, index) => {
        if (!(step instanceof RemoveMarkStep)) {
          return;
        }

        const mapping = combinedTransform.mapping;
        const newStart = mapping.slice(index).map(step.from, -1);
        const newEnd = mapping.slice(index).map(step.to);
        const oldStart = mapping.invert().map(newStart, -1);
        const oldEnd = mapping.invert().map(newEnd);
        // A later ancestor deletion can collapse this range to either document boundary.
        // Inspect only existing final-document neighbors while retaining the original deletion event.
        const documentSize = combinedTransform.doc.content.size;
        const foundBeforeMark = newStart >= 1 && newStart <= documentSize
          && combinedTransform.doc.nodeAt(newStart - 1)?.marks.some((mark) => mark.eq(step.mark));
        const foundAfterMark = newEnd >= 0 && newEnd < documentSize
          && combinedTransform.doc.nodeAt(newEnd)?.marks.some((mark) => mark.eq(step.mark));

        editor.emit("delete", {
          type: "mark",
          mark: step.mark,
          from: step.from,
          to: step.to,
          deletedRange: {
            from: oldStart,
            to: oldEnd
          },
          newRange: {
            from: newStart,
            to: newEnd
          },
          partial: Boolean(foundAfterMark || foundBeforeMark),
          editor,
          transaction,
          combinedTransform
        });
      });
    };

    if (this.options.async) {
      setTimeout(callback, 0);
      return;
    }

    callback();
  }
});

/**
 * Tells whether transactions removed content or a mark, the only changes
 * delete events describe.
 *
 * @param transactions - Root and appended transactions.
 * @returns Whether a step replaced a non-empty range or removed a mark.
 */
function removesContent(transactions: readonly Transaction[]): boolean {
  return transactions.some((transaction) => transaction.steps.some((step) => {
    if (step instanceof RemoveMarkStep) return true;
    let removed = false;
    step.getMap().forEach((from, to) => { if (to > from) removed = true; });
    return removed;
  }));
}

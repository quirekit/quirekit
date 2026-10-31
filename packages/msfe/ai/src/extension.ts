import { Extension, type MsfeEditor } from "@quirekit/msfe-core";
import type { Transaction } from "@quirekit/cm-state";
import { msfeAiReviewField, msfeAiReviewTheme } from "./review/decorations";

const listeners = new WeakMap<MsfeEditor, Set<(transaction: Transaction) => void>>();
const installed = new WeakSet<MsfeEditor>();

/**
 * @param editor - Mounted editor.
 * @returns Whether the MsfeAi extension is installed in it.
 */
export function isMsfeAiInstalled(editor: MsfeEditor): boolean {
  return installed.has(editor);
}

/**
 * Follows an editor's accepted transactions.
 * @param editor - Editor with the MsfeAi extension.
 * @param listener - Called for each accepted transaction.
 * @returns Unsubscribes.
 */
export function followMsfeTransactions(editor: MsfeEditor, listener: (transaction: Transaction) => void): () => void {
  let set = listeners.get(editor);
  if (set === undefined) listeners.set(editor, set = new Set());
  set.add(listener);
  return () => { set!.delete(listener); };
}

/**
 * Prepares an editor for the AI core: reports its transactions to the source document port and
 * draws AI changes awaiting review. Install it with the editor's other extensions.
 */
export const MsfeAi = Extension.create({
  name: "msfeAi",
  addCodeMirrorExtensions() {
    return [msfeAiReviewField, msfeAiReviewTheme];
  },
  onCreate() {
    installed.add(this.editor);
  },
  onTransaction(event) {
    for (const listener of listeners.get(event.editor) ?? []) listener(event.transaction);
  }
});

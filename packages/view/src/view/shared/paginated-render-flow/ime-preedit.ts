import type { QuireImePreedit } from "@quirekit/view-engine";
import type { MountedPaginatedRenderUpdate } from "./types";

/**
 * Carries a retained IME preedit across document changes made while the
 * composition is open, such as a collaborator's edit. The range follows the
 * selection's own mapping, so the preview stays where the commit will land.
 *
 * @param preedit - Retained preedit.
 * @param transactions - Transactions of the current update.
 * @returns Preedit over the current document, or the same object when nothing moved it.
 */
export function mapQuireImePreedit(
  preedit: QuireImePreedit | undefined,
  transactions: MountedPaginatedRenderUpdate<string>["transactions"]
): QuireImePreedit | undefined {
  if (preedit === undefined || transactions === undefined) {
    return preedit;
  }

  let { from, to } = preedit.range;
  for (const transaction of transactions) {
    if (!transaction.docChanged) {
      continue;
    }
    from = transaction.mapping.map(from, 1);
    to = Math.max(from, transaction.mapping.map(to, -1));
  }

  return from === preedit.range.from && to === preedit.range.to
    ? preedit
    : { range: { from, to }, text: preedit.text };
}

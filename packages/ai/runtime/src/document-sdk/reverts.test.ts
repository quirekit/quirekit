import type { Transaction } from "@quirekit/pm";
import { afterEach, expect, it } from "vitest";
import { createDocumentFixture } from "./fixture.test-support";
import { createDocumentReverts } from "./reverts";

const editors: ReturnType<typeof createDocumentFixture>[] = [];
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy(); });

/**
 * Inserts text through the editor and returns the transactions it applied.
 * @param editor - Fixture editor holding "Alpha Beta".
 * @param position - Insert position.
 * @param text - Inserted text.
 * @returns Applied transactions.
 */
function insert(editor: ReturnType<typeof createDocumentFixture>, position: number, text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const collect = ({ transaction }: { transaction: Transaction }) => { transactions.push(transaction); };
  editor.on("transaction", collect);
  editor.commands.insertContentAt(position, text);
  editor.off("transaction", collect);
  return transactions;
}

it("takes back a request's direct writes and keeps the changes made after them", () => {
  const editor = createDocumentFixture();
  editors.push(editor);
  const reverts = createDocumentReverts(editor);
  reverts.record({ executionId: "request", transactions: insert(editor, 6, " Gamma") });
  insert(editor, 1, "Start ");
  insert(editor, editor.state.doc.content.size - 1, " End");
  expect(editor.state.doc.textContent).toBe("Start Alpha Gamma Beta End");

  expect(reverts.without("request", editor.state.doc)?.textContent).toBe("Start Alpha Beta End");
  expect(editor.state.doc.textContent).toBe("Start Alpha Gamma Beta End");
  reverts.revert("request");
  expect(editor.state.doc.textContent).toBe("Start Alpha Beta End");
  expect(reverts.has("request")).toBe(false);
});

it("takes back several direct writes of one request in reverse order, and leaves other requests' writes", () => {
  const editor = createDocumentFixture();
  editors.push(editor);
  const reverts = createDocumentReverts(editor);
  reverts.record({ executionId: "first", transactions: insert(editor, 6, " One") });
  reverts.record({ executionId: "second", transactions: insert(editor, 1, "Other ") });
  reverts.record({ executionId: "first", transactions: insert(editor, editor.state.doc.content.size - 1, " Two") });
  expect(editor.state.doc.textContent).toBe("Other Alpha One Beta Two");

  reverts.revert("first");
  expect(editor.state.doc.textContent).toBe("Other Alpha Beta");
  reverts.revert("second");
  expect(editor.state.doc.textContent).toBe("Alpha Beta");
});

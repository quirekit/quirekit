import { expect, it } from "vitest";
import { createDocumentState } from "../mount/state";
import { sourceBlankLineAt, insertAtSourceBlankLine } from "./insertion";
import { SOURCE_CARET } from "./separators";

it("finds a blank physical line without borrowing a neighboring block", () => {
  const state = createDocumentState("## Title\n\nbody", []);
  expect(sourceBlankLineAt(state, 9)).toEqual({ from: 9, to: 9, scope: { from: 0, to: 14 } });
  expect(sourceBlankLineAt(state, 8)).toBeNull();
  expect(sourceBlankLineAt(state, 10)).toBeNull();
  expect(sourceBlankLineAt(state, -1)).toBeNull();
});

it("keeps an empty document editable immediately after deleting all source", () => {
  const state = createDocumentState("## Heading\n\nbody", []);
  const empty = state.update({ changes: { from: 0, to: state.doc.length } }).state;
  expect(sourceBlankLineAt(empty, 0)).toEqual({ from: 0, to: 0, scope: { from: 0, to: 0 } });
});

it.each(["```ts\n\ncode\n```", "    code\n\n    more", "- first\n\n- second", "<!--\n\n-->"])("does not offer insertion inside syntax-owned blank lines: %s", doc => {
  const state = createDocumentState(doc, []);
  expect(sourceBlankLineAt(state, doc.indexOf("\n\n") + 1)).toBeNull();
});

it.each(["```ts\n", "```ts\ncode\n", "<!--\n"])("does not mistake an unfinished block's final line for document-level whitespace: %s", doc => {
  expect(sourceBlankLineAt(createDocumentState(doc, []), doc.length)).toBeNull();
});

it.each([
  ["", 0, "## New"],
  ["\nbody", 0, "## New\n\nbody"],
  ["body\n", 5, "body\n\n## New"],
  ["```ts\ncode\n```\n", 15, "```ts\ncode\n```\n\n## New"],
  ["before\n\nafter", 7, "before\n\n## New\n\nafter"],
  ["before\n  \nafter", 8, "before\n\n## New\n\nafter"],
  ["before\n\n\n\nafter", 8, "before\n\n## New\n\nafter"],
] as const)("replaces the chosen blank line and retains necessary separators: %s", (doc, pos, expected) => {
  const state = createDocumentState(doc, []), line = sourceBlankLineAt(state, pos)!;
  expect(line).not.toBeNull();
  const spec = insertAtSourceBlankLine(line, "## New")(state)!;
  const transaction = state.update(spec);
  expect(transaction.state.doc.toString()).toBe(expected);
  expect(transaction.state.selection.main.head).toBe(expected.indexOf("## New") + 6);
  expect(transaction.changes.invert(state.doc).apply(transaction.state.doc).toString()).toBe(doc);
  // An empty payload keeps the blank line as an empty paragraph; whitespace is still refused.
  expect(insertAtSourceBlankLine(line, "")(state)).toMatchObject({ selection: { anchor: line.from, head: line.from } });
  expect(insertAtSourceBlankLine(line, "  ")(state)).toBeNull();
  const changed = state.update({ changes: { from: line.from, insert: "typed" } }).state;
  expect(insertAtSourceBlankLine(line, "## New")(changed)).toBeNull();
});

it("places the caret at one SOURCE_CARET and selects between two, never writing the markers", () => {
  const state = createDocumentState("before\n\nafter", []), line = sourceBlankLineAt(state, 7)!;
  const caret = state.update(insertAtSourceBlankLine(line, `\`\`\`\n${SOURCE_CARET}\n\`\`\``)(state)!).state;
  expect(caret.doc.toString()).toBe("before\n\n```\n\n```\n\nafter");
  expect(caret.selection.main.head).toBe(12);
  const range = state.update(insertAtSourceBlankLine(line, `${SOURCE_CARET}Term${SOURCE_CARET}\n: `)(state)!).state;
  expect(range.doc.toString()).toBe("before\n\nTerm\n: \n\nafter");
  expect([range.selection.main.from, range.selection.main.to]).toEqual([8, 12]);
});

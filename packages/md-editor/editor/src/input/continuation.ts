import { EditorSelection, type EditorState, type Transaction, type TransactionSpec } from "@quirekit/cm-state";
import { insertNewlineContinueMarkupCommand } from "@quirekit/cm-lang-markdown";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import { proseInput } from "./paragraph";
import { exitEmptyQuote, splitQuoteParagraph } from "./quote";
import { exitEmptyListItem } from "./list";

const continueMarkup = insertNewlineContinueMarkupCommand({ nonTightLists: false });

/**
 * Uses Markdown's native nesting/numbering rules, with immediate empty-item/quote exit.
 * @param state - Canonical source draft in either editable Prose presentation.
 * @returns One source transaction, or native fallback outside Markdown contexts.
 */
export function continueDocumentMarkup(state: EditorState): TransactionSpec | null {
  if (!proseInput(state)) return null;
  const exit = nextItemAfterBreak(state) ?? exitEmptyQuote(state) ?? exitEmptyListItem(state) ?? splitQuoteParagraph(state);
  if (exit) return exit;
  let planned: Transaction | undefined;
  continueMarkup({ state, dispatch: transaction => { planned = transaction; } });
  const transaction = planned;
  if (!transaction) return null;

  // An exited top-level list needs a real paragraph separator. Otherwise typing
  // on the new blank line becomes a lazy continuation of the preceding list.
  // Nested outdents keep the native parent marker and numbering untouched.
  let index = 0;
  const next = transaction.state.changeByRange(range => {
    const original = state.doc.lineAt(state.selection.ranges[index++]!.head);
    const line = transaction.newDoc.lineAt(range.head);
    const emptyItem = /^(?:\s*>)*\s*(?:[-+*]|\d+[.)])(?:\s+(?:\[[ xX]\])?)?\s*$/u.test(original.text);
    // Enter at an item's text start leaves an empty item above; native continuation trims its space,
    // and a marker without its space would read as literal text.
    const above = line.number > 1 ? transaction.newDoc.line(line.number - 1) : null;
    if (!emptyItem && range.empty && above && /^(?:\s*>)*\s*(?:[-+*]|\d+[.)])(?:\s+\[[ xX]\])?$/u.test(above.text)) {
      return { changes: { from: above.to, insert: " " }, range: EditorSelection.cursor(range.head + 1) };
    }
    if (!emptyItem || !range.empty || !/^[\s>]*$/u.test(line.text) || line.from === 0) return { range };
    const blank = (number: number) => number < 1 || number > transaction.newDoc.lines || /^[\s>]*$/u.test(transaction.newDoc.line(number).text);
    // Typing on the exit row must not join the following paragraph either.
    const before = blank(line.number - 1) ? "" : `\n${line.text}`, after = blank(line.number + 1) ? "" : `\n${line.text}`;
    if (!before && !after) return { range };
    return { changes: [{ from: range.head, insert: before }, { from: range.head, insert: after }],
      range: EditorSelection.cursor(range.head + before.length) };
  });
  return { changes: transaction.changes.compose(next.changes), selection: next.selection, scrollIntoView: true, userEvent: "input" };
}

/**
 * Enter on a later line of a list item (after Shift+Enter) starts the next item, as rich editors
 * do, instead of continuing the same paragraph. On the still-empty row after the break, the
 * break and the row give way to the new item.
 * @param state - Source before Enter.
 * @returns The new item with following ordered items renumbered, or null outside that position.
 */
export function nextItemAfterBreak(state: EditorState): TransactionSpec | null {
  const range = state.selection.main;
  if (!proseInput(state) || state.selection.ranges.length > 1 || !range.empty) return null;
  const line = state.doc.lineAt(range.head), previous = line.number > 1 ? state.doc.line(line.number - 1) : null;
  if (!previous || !/(?: {2,}|\\)$/u.test(previous.text) || /^\s*>/u.test(line.text)) return null;
  const pending = /^\s*$/u.test(line.text);
  const item = listItemAt(state, pending ? previous.to : range.head);
  if (!item || state.doc.lineAt(item.from).number === line.number) return null;
  const match = /^((?:\s*>)*\s*)(?:([-+*])|(\d+)([.)]))(\s+)(\[[ xX]\]\s)?/u.exec(state.doc.lineAt(item.from).text);
  if (!match) return null;
  const [, indent, bullet, number, delimiter, space, task] = match;
  const prefix = `${indent}${bullet ?? `${Number(number) + 1}${delimiter}`}${space}${task ? "[ ] " : ""}`;
  const from = pending ? previous.to - /(?: +|\\)$/u.exec(previous.text)![0].length : range.head;
  const to = pending ? line.to : range.head;
  return { changes: [{ from, to, insert: `\n${prefix}` }, ...(number ? renumber(state, item, Number(number) + 2) : [])],
    selection: EditorSelection.cursor(from + 1 + prefix.length), scrollIntoView: true, userEvent: "input" };
}

/** @param state - Source. @param position - Source offset. @returns The innermost list item there. */
function listItemAt(state: EditorState, position: number): SyntaxNode | null {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, -1);
  while (node && node.name !== "ListItem") node = node.parent;
  return node;
}

/** @param state - Source. @param item - Item the new one follows. @param next - Number the item after the new one needs. @returns Mark changes keeping the following items ascending. */
function renumber(state: EditorState, item: SyntaxNode, next: number) {
  const changes = [];
  for (let sibling = item.nextSibling; sibling?.name === "ListItem"; sibling = sibling.nextSibling, next++) {
    const mark = sibling.getChild("ListMark"), value = mark ? /^\d+/u.exec(state.sliceDoc(mark.from, mark.to)) : null;
    if (!mark || !value || Number(value[0]) >= next) break;
    changes.push({ from: mark.from, to: mark.from + value[0].length, insert: String(next) });
  }
  return changes;
}

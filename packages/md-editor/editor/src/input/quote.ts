import { EditorSelection, type EditorState, type TransactionSpec } from "@quirekit/cm-state";
import { syntaxTree, syntaxTreeAvailable } from "@quirekit/cm-language";
import { readSourcePresentation } from "@quirekit/msfe-core";

/**
 * Resolves only the innermost confirmed empty quote marker on the caret's line.
 * @param state - Accepted source and syntax.
 * @param position - Empty selection endpoint.
 * @returns The marker start, excluding outer quote/list prefixes, or no admitted exit.
 */
function emptyQuoteStart(state: EditorState, position: number): number | null {
  const line = state.doc.lineAt(position);
  if (!syntaxTreeAvailable(state, line.to)) return null;
  let owner = syntaxTree(state).resolveInner(position, -1);
  if (owner.name === "QuoteMark") owner = owner.parent!;
  if (owner.name !== "Blockquote") return null;
  const mark = owner.childBefore(line.to);
  return mark?.name === "QuoteMark" && mark.from >= line.from && position >= mark.to
    && !state.sliceDoc(mark.to, line.to).trim() ? mark.from : null;
}

/**
 * Exits one empty quote level without waiting for a second empty quoted row.
 * @param state - Editable Prose state already admitted by the shared input guard.
 * @returns One atomic source edit for compatible carets, or native continuation.
 */
export function exitEmptyQuote(state: EditorState): TransactionSpec | null {
  const separated = exitAfterSeparator(state);
  if (separated) return separated;
  const starts = state.selection.ranges.map(range => range.empty ? emptyQuoteStart(state, range.head) : null);
  if (starts.some(from => from === null)) return null;
  let index = 0;
  const changes = state.changeByRange(range => {
    const from = starts[index++]!, line = state.doc.lineAt(range.head), prefix = state.sliceDoc(line.from, from);
    // A semantic exit needs both a separator and an editable row. Reuse the
    // adjacent outer-flow blank when present; do not grow every existing gap.
    const needsSeparator = line.number > 1 && /^[\t >]*$/u.test(prefix)
      && !/^[\t >]*$/u.test(state.doc.line(line.number - 1).text);
    const next = line.number < state.doc.lines ? state.doc.line(line.number + 1) : null;
    // Reusing it is safe only when it is not the separator before following
    // content; otherwise text typed on it would join that paragraph.
    const after = next && next.number < state.doc.lines ? state.doc.line(next.number + 1) : null;
    const reuseNext = needsSeparator && next?.text === prefix && (!after || /^[\t >]*$/u.test(after.text));
    const insert = needsSeparator ? `\n${prefix}` : "";
    // Include a reused row in the replacement so native history maps the old
    // marker caret to the editable row on redo, not to its collapsed separator.
    const to = reuseNext ? next!.to : line.to;
    return { changes: { from, to, insert }, range: EditorSelection.cursor(from + insert.length) };
  });
  return { ...changes, scrollIntoView: true, userEvent: "input" };
}

/** @param text - Source line. @returns Its quote depth when it holds only quote markers, otherwise null. */
function bareQuoteDepth(text: string): number | null {
  return /^[\t ]*(?:>[\t ]*)+$/u.test(text) ? (text.match(/>/gu) ?? []).length : null;
}

/**
 * Enter on the empty paragraph a quote's Enter opened also removes the bare marker row
 * that separated it, so leaving the quote does not keep an empty quoted line.
 * @param state - Editable Prose state.
 * @returns The exit without the separator, or null when the empty row has none above it.
 */
function exitAfterSeparator(state: EditorState): TransactionSpec | null {
  const { main } = state.selection;
  if (state.selection.ranges.length !== 1 || !main.empty || emptyQuoteStart(state, main.head) === null) return null;
  const line = state.doc.lineAt(main.head);
  if (line.number < 3) return null;
  const separator = state.doc.line(line.number - 1), above = state.doc.line(line.number - 2);
  const depth = bareQuoteDepth(line.text);
  if (depth === null || bareQuoteDepth(separator.text) !== depth || bareQuoteDepth(above.text) !== null || !/\S/u.test(above.text)) return null;
  const removal = state.update({ changes: { from: separator.from, to: line.from }, selection: EditorSelection.cursor(main.head - line.from + separator.from) });
  if (!syntaxTreeAvailable(removal.state, removal.state.doc.length)) return null;
  const exit = exitEmptyQuote(removal.state);
  if (!exit) return null;
  const second = removal.state.update(exit);
  return { changes: removal.changes.compose(second.changes), selection: second.state.selection, scrollIntoView: true, userEvent: "input" };
}

/**
 * Enter inside a quoted paragraph starts a new paragraph in the quote, as rich editors do,
 * instead of a continuation line of the same paragraph; Shift-Enter keeps the line break.
 * @param state - Editable Prose state.
 * @returns The split with a bare marker row between the paragraphs, or null outside quoted paragraph text.
 */
export function splitQuoteParagraph(state: EditorState): TransactionSpec | null {
  const { main } = state.selection;
  if (state.selection.ranges.length !== 1 || !main.empty) return null;
  const line = state.doc.lineAt(main.head), prefix = /^(?:[\t ]*>[\t ]?)+/u.exec(line.text)?.[0];
  if (!prefix || main.head <= line.from + prefix.length || !syntaxTreeAvailable(state, line.to)) return null;
  let node = syntaxTree(state).resolveInner(main.head, -1);
  while (node.parent && node.name !== "Paragraph") node = node.parent;
  // Only a paragraph directly in a quote: lists and code inside quotes keep their own Enter.
  if (node.name !== "Paragraph" || node.parent?.name !== "Blockquote" || main.head <= node.from) return null;
  const insert = `\n${prefix.trimEnd()}\n${prefix}`;
  return { changes: { from: main.head, insert }, selection: EditorSelection.cursor(main.head + insert.length), scrollIntoView: true, userEvent: "input" };
}

/**
 * Backspace at the text start of a later line in a top-level quote moves that
 * line out as its own paragraph; deleting only the marker would leave a lazy
 * continuation that still renders inside the quote.
 * @param state - Editable Prose state.
 * @returns One source edit, or null for native deletion.
 */
export function unwrapQuoteLine(state: EditorState): TransactionSpec | null {
  const { main } = state.selection;
  if (state.selection.ranges.length !== 1 || !main.empty || readSourcePresentation(state).mode !== "live") return null;
  const line = state.doc.lineAt(main.head), mark = /^> ?/u.exec(line.text);
  if (!mark || main.head !== line.from + mark[0].length || line.number === 1 || !syntaxTreeAvailable(state, line.to)) return null;
  let owner = syntaxTree(state).resolveInner(line.from + 1, -1);
  while (owner.name !== "Blockquote" && owner.parent) owner = owner.parent;
  if (owner.name !== "Blockquote" || owner.parent?.name !== "Document" || owner.from >= line.from) return null;
  return { changes: { from: line.from, to: main.head, insert: "\n" }, selection: EditorSelection.cursor(line.from + 1) };
}

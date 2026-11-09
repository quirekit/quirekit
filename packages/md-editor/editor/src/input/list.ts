import { EditorSelection, type EditorState, type Line, type TransactionSpec } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import { readSourcePresentation } from "@quirekit/msfe-core";
import { changeListIndent } from "@quirekit/msfe-prose";

const outdent = changeListIndent(-1);

/** @param state - Canonical source. @returns The collapsed caret when one plain caret may own a list gesture. */
function caret(state: EditorState): number | null {
  const { main } = state.selection;
  return state.selection.ranges.length === 1 && main.empty && !state.readOnly && !readSourcePresentation(state).composing ? main.head : null;
}

/** @param state - Canonical source. @param position - Source position. @param side - Syntax side. @param name - Wanted ancestor. @returns Nearest ancestor with that name. */
function ancestor(state: EditorState, position: number, side: -1 | 1, name: string): SyntaxNode | null {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, side); node; node = node.parent) if (node.name === name) return node;
  return null;
}

/** @param state - Canonical source. @param position - Source position. @param side - Syntax side. @returns Whether the position is inside paragraph or task text. */
export function inText(state: EditorState, position: number, side: -1 | 1): boolean {
  return !!(ancestor(state, position, side, "Paragraph") ?? ancestor(state, position, side, "Task"));
}

/** @param state - Canonical source. @param from - Position after a marker. @returns Position after the spaces that follow it on its line. */
function afterSpaces(state: EditorState, from: number): number {
  return from + /^[ \t]*/u.exec(state.sliceDoc(from, state.doc.lineAt(from).to))![0].length;
}

/** Text start of one list item's first line. */
export interface ItemStart {
  /** Confirmed list item. */
  readonly item: SyntaxNode;
  /** Start of the bullet or number. */
  readonly markFrom: number;
  /** Task checkbox interval including its trailing space, absent for plain items. */
  readonly task: { readonly from: number; readonly to: number } | null;
  /** First body character after the marker and any task checkbox. */
  readonly bodyFrom: number;
}

/** @param state - Canonical source. @param line - Candidate first line. @returns The item that starts on this line, with its text start. */
export function itemStart(state: EditorState, line: Line): ItemStart | null {
  const first = line.from + /^[\s>]*/u.exec(line.text)![0].length;
  const item = ancestor(state, Math.min(first + 1, line.to), -1, "ListItem");
  const mark = item?.getChild("ListMark");
  if (!item || !mark || state.doc.lineAt(mark.from).number !== line.number) return null;
  const marker = item.getChild("Task")?.getChild("TaskMarker");
  const task = marker && state.doc.lineAt(marker.from).number === line.number ? { from: marker.from, to: afterSpaces(state, marker.to) } : null;
  return { item, markFrom: mark.from, task, bodyFrom: task?.to ?? afterSpaces(state, mark.to) };
}

/**
 * Backspace on an empty row after a list returns to the end of the last item's
 * text, removing the row and its separators. When the list continues below, the
 * two halves rejoin as one list.
 * @param state - Canonical source draft. @param line - Blank caret line.
 * @returns The join, or null when no item text precedes the row.
 */
function joinEmptyRow(state: EditorState, line: Line): TransactionSpec | null {
  let above = line.number - 1;
  while (above >= 1 && !/\S/u.test(state.doc.line(above).text)) above--;
  if (above < 1) return null;
  const end = state.doc.line(above).to;
  if (!ancestor(state, end, -1, "ListItem") || !inText(state, end, -1)) return null;
  let below = line.number + 1;
  while (below <= state.doc.lines && !/\S/u.test(state.doc.line(below).text)) below++;
  const rejoin = below <= state.doc.lines && itemStart(state, state.doc.line(below));
  return { changes: { from: end, to: rejoin ? state.doc.line(below).from - 1 : line.to }, selection: EditorSelection.cursor(end) };
}

/**
 * Backspace at a list item's text start, empty or not, peels one layer as rich
 * editors do: a nested item moves out one level and a root item, task included,
 * becomes a paragraph. A paragraph or empty row right after a list joins the
 * last item's text.
 * @param state - Canonical source draft.
 * @returns One structural edit, or null to keep native deletion.
 */
export function deleteListMarkupBackward(state: EditorState): TransactionSpec | null {
  const head = caret(state);
  if (head === null) return null;
  const live = readSourcePresentation(state).mode === "live", line = state.doc.lineAt(head);
  const start = itemStart(state, line);
  if (start && head === start.bodyFrom) {
    // Source mode shows the marker as text, so only the marker itself goes.
    return live ? outdent(state) : { changes: { from: start.markFrom, to: head }, selection: EditorSelection.cursor(start.markFrom) };
  }
  if (!live) return null;
  if (!/\S/u.test(line.text)) return joinEmptyRow(state, line);
  const paragraph = ancestor(state, head, 1, "Paragraph");
  const list = paragraph?.from === head ? paragraph.prevSibling : null;
  if (!list || !/^(?:Bullet|Ordered)List$/u.test(list.name) || list.parent !== paragraph!.parent) return null;
  // Join only into item text; a trailing fence or table keeps native deletion.
  if (!inText(state, list.to, -1)) return null;
  const end = state.doc.lineAt(list.to).to;
  return { changes: { from: end, to: head }, selection: EditorSelection.cursor(end) };
}

/**
 * Enter on an empty item outdents it with its children: a nested item moves up one level, and a root
 * item between siblings or with children becomes a paragraph; a childless last root item keeps
 * Markdown's native exit.
 * @param state - Canonical source draft.
 * @returns The split, or null for native continuation.
 */
export function exitEmptyListItem(state: EditorState): TransactionSpec | null {
  const head = caret(state);
  if (head === null) return null;
  const line = state.doc.lineAt(head), start = itemStart(state, line);
  if (!start || head !== line.to || start.bodyFrom !== line.to || /^\s*>/u.test(line.text)) return null;
  // A nested empty item outdents with its children, as Backspace does; native continuation would leave them behind.
  if (start.item.parent?.parent?.name === "ListItem") return outdent(state);
  let next = start.item.nextSibling;
  while (next && next.name !== "ListItem") next = next.nextSibling;
  return next || start.item.getChild("BulletList") || start.item.getChild("OrderedList") ? outdent(state) : null;
}

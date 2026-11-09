import { EditorSelection, type ChangeSpec, type EditorState, type Line, type TransactionSpec } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import { readSourcePresentation } from "@quirekit/msfe-core";
import { inText, itemStart } from "../list";

/** @param state - Canonical source. @returns The collapsed caret when one plain live-mode caret may own Delete. */
function caret(state: EditorState): number | null {
  const { main } = state.selection, presentation = readSourcePresentation(state);
  return state.selection.ranges.length === 1 && main.empty && !state.readOnly && presentation.mode === "live" && !presentation.composing ? main.head : null;
}

/** @param state - Canonical source. @param line - Line to start after. @returns The next line with content, or null at the end. */
function nextContent(state: EditorState, line: Line): Line | null {
  for (let number = line.number + 1; number <= state.doc.lines; number++) {
    const next = state.doc.line(number);
    if (/\S/u.test(next.text)) return next;
  }
  return null;
}

/** @param state - Canonical source. @param line - Content line. @returns Where that line's text starts, after list or quote markup. */
function textStart(state: EditorState, line: Line): number {
  const item = itemStart(state, line);
  return item ? item.bodyFrom : line.from + /^(?:[ \t]*>[ \t]?)*[ \t]*/u.exec(line.text)![0].length;
}

/** @param state - Canonical source. @param item - List item. @returns Its number's start and digits, or null for a bullet. */
function ordinal(state: EditorState, item: SyntaxNode): { from: number; digits: string } | null {
  const mark = item.getChild("ListMark"), digits = mark && /^\d+/u.exec(state.sliceDoc(mark.from, mark.to))?.[0];
  return mark && digits ? { from: mark.from, digits } : null;
}

/**
 * @param state - Canonical source. @param item - List item that leaves its list. @returns Ordinal edits giving
 * its following siblings the numbers from its own onward, as rich editors renumber; none for bullets.
 */
function renumberAfter(state: EditorState, item: SyntaxNode): ChangeSpec[] {
  const own = ordinal(state, item);
  if (!own) return [];
  const changes: ChangeSpec[] = [];
  let number = Number(own.digits);
  for (let sibling = item.nextSibling; sibling?.name === "ListItem"; sibling = sibling.nextSibling, number++) {
    const next = ordinal(state, sibling);
    if (next && next.digits !== String(number)) changes.push({ from: next.from, to: next.from + next.digits.length, insert: String(number) });
  }
  return changes;
}

/**
 * @param state - Canonical source. @param item - Item whose first line goes away. @param width - Columns its children move left.
 * @returns Indentation edits moving the item's later lines out by its marker width.
 */
function outdentRest(state: EditorState, item: SyntaxNode, width: number): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  for (let number = state.doc.lineAt(item.from).number + 1; number <= state.doc.lineAt(item.to).number; number++) {
    const line = state.doc.line(number), spaces = /^ */u.exec(line.text)![0].length;
    if (spaces) changes.push({ from: line.from, to: line.from + Math.min(spaces, width) });
  }
  return changes;
}

/**
 * Delete in an empty list item or empty quote row removes that row; the next block
 * keeps its own structure and the caret moves to its text.
 * @param state - Canonical source. @param line - Caret line. @param head - Caret.
 * @returns The removal, or null when the row is not an empty block row.
 */
function removeEmptyRow(state: EditorState, line: Line, head: number): TransactionSpec | null {
  const item = itemStart(state, line);
  const empty = item ? head === item.bodyFrom && head === line.to : /^[ \t]*>[ \t>]*$/u.test(line.text) && head === line.to;
  if (!empty) return null;
  const next = nextContent(state, line);
  if (!next) return {};
  // The empty item's children take its place one level out; following ordered items close the gap.
  const changes = [{ from: line.from, to: line.to + 1 }, ...(item ? [...outdentRest(state, item.item, item.bodyFrom - item.markFrom), ...renumberAfter(state, item.item)] : [])];
  const edits = state.changes(changes);
  return { changes: edits, selection: EditorSelection.cursor(edits.mapPos(textStart(state, next), 1)) };
}

/** @param state - Canonical source. @param position - Source position. @param name - Wanted ancestor. @returns Its end, or null outside it. */
function ancestorEnd(state: EditorState, position: number, name: string): number | null {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, 1); node; node = node.parent) if (node.name === name) return node.to;
  return null;
}

/**
 * Delete at the end of text pulls the next list item or quote line's text up, without its
 * markup, as rich editors join paragraphs. What remains of that block keeps its structure:
 * a pulled item's children move out with it and following items stay a list.
 * @param state - Canonical source. @param line - Caret line. @param head - Caret at its end.
 * @returns The join, or null when the next block is not a list item or quote line.
 */
function joinNextText(state: EditorState, line: Line, head: number): TransactionSpec | null {
  if (!inText(state, head, -1) || /^\s*>/u.test(line.text)) return null;
  const next = nextContent(state, line);
  if (!next) return null;
  const item = itemStart(state, next), quoted = !item && /^\s*>/u.test(next.text);
  if (!item && !quoted) return null;
  const changes: ChangeSpec[] = [{ from: head, to: textStart(state, next) }];
  // Inside a list item the pulled item's children and siblings already have a list to stay in.
  const rest = item ? item.item.parent!.to : ancestorEnd(state, next.from, "Blockquote") ?? next.to;
  if (ancestorEnd(state, line.from + /^\s*/u.exec(line.text)![0].length, "ListItem") === null && rest > next.to) {
    // A paragraph cannot hold the remaining items or quote lines: they stay a block of their own
    // below it, and the pulled item's children move out by its marker width.
    changes.push({ from: next.to, to: next.to, insert: "\n" });
    if (item) changes.push(...outdentRest(state, item.item, item.bodyFrom - item.markFrom), ...renumberAfter(state, item.item));
  }
  return { changes, selection: EditorSelection.cursor(head) };
}

/**
 * Delete at the end of front matter would merge its closing fence into the data.
 * @param state - Canonical source. @param head - Caret.
 * @returns A no-op inside front matter's last data line, or null elsewhere.
 */
function keepFrontmatter(state: EditorState, head: number): TransactionSpec | null {
  const line = state.doc.lineAt(head);
  if (head !== line.to || line.number >= state.doc.lines) return null;
  let node = syntaxTree(state).resolveInner(head, -1);
  while (node.parent && node.name !== "Frontmatter") node = node.parent;
  return node.name === "Frontmatter" && state.doc.lineAt(node.to).number === line.number + 1 ? {} : null;
}

/**
 * Delete in document presentations, following rich editors: an empty row goes away, text at a
 * line end pulls the next item or quote line up, and front matter keeps its closing fence.
 * @param state - Canonical source draft.
 * @returns One structural edit, or null to keep native deletion.
 */
export function deleteForward(state: EditorState): TransactionSpec | null {
  const head = caret(state);
  if (head === null) return null;
  const line = state.doc.lineAt(head);
  if (head !== line.to || line.number === state.doc.lines) return null;
  return keepFrontmatter(state, head) ?? removeEmptyRow(state, line, head) ?? joinNextText(state, line, head);
}

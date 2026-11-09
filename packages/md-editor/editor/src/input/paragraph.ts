import { EditorSelection, type EditorState, type TransactionSpec } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import { readSourcePresentation } from "@quirekit/msfe-core";
import { collapseBlankLine } from "../presentation/boundaries/separator";
import { itemStart } from "./list";

/** @param state - Canonical editor state. @returns Whether product document input owns this key gesture. */
export function documentInput(state: EditorState): boolean {
  return proseInput(state) && readSourcePresentation(state).reveal === "hidden";
}

/** @param state - Canonical editor state. @returns Whether either editable Prose presentation owns this gesture. */
export function proseInput(state: EditorState): boolean {
  const { mode, composing } = readSourcePresentation(state);
  return mode === "live" && !state.readOnly && !composing;
}

/** @param state - Source document. @param position - Selection endpoint. @param side - Syntax on the selected side of a boundary. @returns A paragraph split/end, leaving list/quote/code body continuation to Markdown. */
function paragraphBoundary(state: EditorState, position: number, side: -1 | 1 = -1): number | null {
  let boundary: number | null = null;
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, side); node; node = node.parent) {
    if (["ListItem", "Blockquote", "CodeBlock", "Table", "HTMLBlock"].includes(node.name)) return null;
    if (node.name === "FencedCode" || node.name === "Frontmatter") {
      if (node.getChildren(node.name === "FencedCode" ? "CodeMark" : "FrontmatterMark").length !== 2 || position !== node.to) return null;
      boundary = node.to;
    }
    if (node.name === "CustomContainer" && position === node.to && node.getChildren("ContainerMark").length === 2) boundary = node.to;
    if (node.name === "HorizontalRule") {
      // A thematic break has no text to split: Enter anywhere on it opens a paragraph below.
      boundary = node.to;
    } else if (node.name === "Paragraph" || /^ATXHeading[1-6]$/u.test(node.name)) {
      boundary = position;
    } else if (/^SetextHeading[12]$/u.test(node.name) && position === state.doc.lineAt(node.from).to) {
      boundary = node.to;
    }
  }
  return boundary;
}

/** @param state - Source document. @param position - Caret. @returns The end of a thematic break whose line starts at the caret. */
function ruleEnd(state: EditorState, position: number): number | null {
  const rule = syntaxTree(state).resolveInner(position, 1);
  return rule.name === "HorizontalRule" && rule.from === state.doc.lineAt(position).from ? rule.to : null;
}

/** @param state - Canonical source. @param node - Block being exited. @returns Outer quote/list continuation, retaining exact source indentation. */
function continuationPrefix(state: EditorState, node: SyntaxNode): string {
  const line = state.doc.lineAt(node.from);
  let prefix = state.sliceDoc(line.from, node.from);
  // A fence/table may begin on a list's first line. Preserve the outer quote
  // spelling while replacing only confirmed list markers by equal-width spaces.
  for (let parent = node.parent; parent; parent = parent.parent) {
    const mark = parent.name === "ListItem" ? parent.getChild("ListMark") : null;
    if (mark && mark.from >= line.from && mark.to <= node.from) {
      prefix = prefix.slice(0, mark.from - line.from) + " ".repeat(mark.to - mark.from) + prefix.slice(mark.to - line.from);
    }
  }
  return prefix;
}

/** @param state - Source-owned input draft. @returns One paragraph replacement per supported selection, or native Markdown continuation. */
export function insertDocumentParagraph(state: EditorState): TransactionSpec | null {
  if (!proseInput(state)) return null;
  // Both ends must belong to prose that this command can split. Resolve every
  // range before planning edits so mixed code/list/table selections fall through
  // atomically, while prose replacements retain unselected spaces and markers.
  const boundaries = state.selection.ranges.map(range => range.empty ? ruleEnd(state, range.head) ?? paragraphBoundary(state, range.head)
    : paragraphBoundary(state, range.from, 1) === range.from && paragraphBoundary(state, range.to) === range.to ? range.from : null);
  if (boundaries.some(boundary => boundary === null)) return null;
  let index = 0;
  const changes = state.changeByRange(range => {
    const from = boundaries[index++]!, line = state.doc.lineAt(from);
    // Enter before a heading's text opens a paragraph above it; splitting there
    // would leave an empty heading and demote the text to a paragraph.
    if (range.empty && from < line.to && /^#{1,6}[ \t]+$/u.test(state.sliceDoc(line.from, from))) {
      return { changes: { from: line.from, insert: "\n\n" }, range: EditorSelection.cursor(from + 2) };
    }
    return { changes: { from, to: range.empty ? from : range.to, insert: "\n\n" }, range: EditorSelection.cursor(from + 2) };
  });
  return { ...changes, scrollIntoView: true, userEvent: "input" };
}

/**
 * Enter on a visible empty row right after a block. Such a row shows only
 * because it ends the document or flow; one more break would turn it into a
 * collapsed separator and the caret would not visibly move, so two are inserted.
 * @param state - Source-owned input draft.
 * @returns The insertion, or null for native Enter.
 */
export function openBlankRow(state: EditorState): TransactionSpec | null {
  const { main } = state.selection;
  if (!proseInput(state) || state.selection.ranges.length !== 1 || !main.empty) return null;
  const line = state.doc.lineAt(main.head);
  if (/\S/u.test(line.text) || line.number === 1 || !/\S/u.test(state.doc.line(line.number - 1).text)) return null;
  if (syntaxTree(state).resolveInner(main.head, -1).name !== "Document" || collapseBlankLine(state, line)) return null;
  return { changes: { from: main.head, insert: "\n\n" }, selection: EditorSelection.cursor(main.head + 2), scrollIntoView: true, userEvent: "input" };
}

/** @param state - Source-owned input draft. @returns A paragraph after the nearest enclosing block for Mod-Enter. */
export function exitDocumentBlock(state: EditorState): TransactionSpec | null {
  if (!proseInput(state) || state.selection.ranges.length !== 1 || !state.selection.main.empty) return null;
  const position = state.selection.main.head;
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, -1); node; node = node.parent) {
    if (!["FencedCode", "Frontmatter", "CustomContainer", "Table", "Blockquote", "BulletList", "OrderedList"].includes(node.name)) continue;
    if (node.name === "FencedCode" && node.getChildren("CodeMark").length !== 2
      || node.name === "Frontmatter" && node.getChildren("FrontmatterMark").length !== 2
      || node.name === "CustomContainer" && node.getChildren("ContainerMark").length !== 2) return null;
    const prefix = continuationPrefix(state, node), insert = `\n${prefix}\n${prefix}`;
    return { changes: { from: node.to, insert }, selection: EditorSelection.cursor(node.to + insert.length), scrollIntoView: true, userEvent: "input" };
  }
  return insertDocumentParagraph(state);
}

/**
 * @param state - Canonical source. @param from - Selection start. @param to - Selection end. @param side - Syntax side at the start.
 * @returns The prose block a hard break belongs to, null inside literal blocks, or undefined when none is found on that side.
 */
function lineBreakOwner(state: EditorState, from: number, to: number, side: -1 | 1): SyntaxNode | null | undefined {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(from, side); node; node = node.parent) {
    if (["FencedCode", "CodeBlock", "Frontmatter", "TableCell", "Table", "HTMLBlock"].includes(node.name)) return null;
    if (node.name === "Paragraph" || node.name === "Task" || /^ATXHeading[1-6]$/u.test(node.name)) return from >= node.from && to <= node.to ? node : undefined;
  }
  return undefined;
}

/** @param state - Canonical source draft. @returns A Markdown hard break retaining outer quote/list prefixes, or native code/source fallback. */
export function insertDocumentLineBreak(state: EditorState): TransactionSpec | null {
  if (!proseInput(state)) return null;
  // An empty item has no text a hard break could follow; the key keeps the list intact.
  const { main } = state.selection, start = state.selection.ranges.length === 1 && main.empty ? itemStart(state, state.doc.lineAt(main.head)) : null;
  if (start && main.head === start.bodyFrom && main.head === state.doc.lineAt(main.head).to) return {};
  const owners = state.selection.ranges.map(range => lineBreakOwner(state, range.from, range.to, -1) ?? lineBreakOwner(state, range.from, range.to, 1));
  if (owners.some(owner => !owner)) return null;
  let index = 0;
  const changes = state.changeByRange(range => {
    const owner = owners[index++]!, line = state.doc.lineAt(range.from);
    const spaces = / {0,2}$/u.exec(state.sliceDoc(line.from, range.from))![0].length;
    const prefix = continuationPrefix(state, owner);
    // Trailing spaces only break after text; at the start of a line's text the backslash form still breaks.
    const marker = owner.name === "Task" ? owner.getChild("TaskMarker") : null;
    const before = state.sliceDoc(Math.max(line.from, marker?.to ?? owner.from), range.from);
    const insert = /\S/u.test(before) ? `${" ".repeat(2 - spaces)}\n${prefix}` : `\\\n${prefix}`;
    return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(range.from + insert.length) };
  });
  return { ...changes, scrollIntoView: true, userEvent: "input" };
}

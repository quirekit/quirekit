import { EditorSelection, type EditorState, type Line, type TransactionSpec } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import { BlockType, type EditorView } from "@quirekit/cm-view";
import { commandKeyBinding, readSourcePresentation } from "@quirekit/msfe-core";

/** Blocks whose text cannot absorb a neighboring paragraph without breaking their syntax. */
export const closedBlocks = new Set(["FencedCode", "CodeBlock", "Table", "CustomContainer", "DisplayMath", "HTMLBlock", "Frontmatter"]);

/** @param state - Canonical source. @returns The caret when one plain live-mode caret may own a block-edge gesture. */
function caret(state: EditorState): number | null {
  const { main } = state.selection, { mode, composing } = readSourcePresentation(state);
  return state.selection.ranges.length === 1 && main.empty && mode === "live" && !composing && !state.readOnly ? main.head : null;
}

/** @param line - Source line. @returns Whether the line only separates blocks. */
function blank(line: Line): boolean { return !/\S/u.test(line.text); }

/** @param state - Canonical source. @param position - Position on a non-blank line. @returns The top-level block containing it. */
export function topBlock(state: EditorState, position: number): SyntaxNode | null {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, -1);
  while (node?.parent && node.parent.name !== "Document") node = node.parent;
  return node?.parent ? node : null;
}

/** @param state - Canonical source. @param line - Caret line. @param direction - Search upward or downward. @returns The nearest top-level block across blank rows. */
function neighbor(state: EditorState, line: Line, direction: -1 | 1): SyntaxNode | null {
  for (let number = line.number + direction; number >= 1 && number <= state.doc.lines; number += direction) {
    const next = state.doc.line(number);
    if (!blank(next)) return topBlock(state, direction < 0 ? next.to : next.from + 1);
  }
  return null;
}

/** @param state - Canonical source. @param block - Closed block. @returns The end of its editable text, before a closing fence or table pipe. */
function contentEnd(state: EditorState, block: SyntaxNode): number {
  const last = state.doc.lineAt(block.to);
  if (block.name === "Table") {
    const pipe = last.text.trimEnd().lastIndexOf("|");
    return pipe > 0 ? last.from + last.text.slice(0, pipe).trimEnd().length : last.to;
  }
  const fenced = /^(?:FencedCode|CustomContainer|DisplayMath|Frontmatter)$/u.test(block.name) && last.number > state.doc.lineAt(block.from).number;
  return fenced ? state.doc.line(last.number - 1).to : last.to;
}

/** @param state - Canonical source. @param line - Caret line. @returns Whether the caret line is a top-level paragraph or an empty row. */
function plainRow(state: EditorState, line: Line): boolean {
  return blank(line) ? !topBlock(state, line.from) : topBlock(state, line.from + 1)?.name === "Paragraph";
}

/**
 * Backspace at the start of a paragraph or empty row after a block that cannot
 * absorb text: a thematic break is removed; for code, tables, containers and
 * similar blocks the caret moves to the end of their text, dropping an empty row.
 * @param state - Canonical source draft.
 * @returns One edit or caret move, or null for native deletion.
 */
export function deleteBlockEdgeBackward(state: EditorState): TransactionSpec | null {
  const head = caret(state);
  if (head === null) return null;
  const line = state.doc.lineAt(head);
  if (head !== line.from || !plainRow(state, line)) return null;
  const previous = neighbor(state, line, -1);
  if (!previous || previous.to >= line.from) return null;
  if (previous.name === "HorizontalRule") {
    const rule = state.doc.lineAt(previous.from);
    return { changes: { from: rule.from, to: head }, selection: EditorSelection.cursor(rule.from) };
  }
  if (!closedBlocks.has(previous.name)) return null;
  const end = contentEnd(state, previous);
  if (!blank(line)) return { selection: EditorSelection.cursor(end) };
  // An empty row goes together with the separator above it.
  return { changes: { from: state.doc.lineAt(previous.to).to, to: line.to }, selection: EditorSelection.cursor(end) };
}

/**
 * Delete at the end of a paragraph before a block that cannot absorb text: a
 * thematic break is removed, other blocks are left intact.
 * @param state - Canonical source draft.
 * @returns One edit or an explicit no-op, or null for native deletion.
 */
export function deleteBlockEdgeForward(state: EditorState): TransactionSpec | null {
  const head = caret(state);
  if (head === null) return null;
  const line = state.doc.lineAt(head);
  if (head !== line.to || blank(line) || topBlock(state, head)?.name !== "Paragraph") return null;
  const next = neighbor(state, line, 1);
  if (!next || next.from <= line.to) return null;
  if (next.name === "HorizontalRule") return { changes: { from: head, to: state.doc.lineAt(next.to).to } };
  return closedBlocks.has(next.name) ? {} : null;
}

/**
 * Backspace inside a code block whose body is empty removes the whole block,
 * leaving an empty paragraph row, instead of moving the caret elsewhere.
 * @param state - Canonical source draft.
 * @returns The removal, or null when the block has content.
 */
export function deleteEmptyCodeBlock(state: EditorState): TransactionSpec | null {
  const head = caret(state);
  if (head === null) return null;
  const block = topBlock(state, head);
  if (block?.name !== "FencedCode" || block.getChildren("CodeMark").length !== 2) return null;
  const open = state.doc.lineAt(block.from), close = state.doc.lineAt(block.to);
  if (head <= open.to || head > close.from || /\S/u.test(state.sliceDoc(open.to, close.from)) || head !== state.doc.lineAt(head).from) return null;
  return { changes: { from: open.from, to: close.to }, selection: EditorSelection.cursor(open.from) };
}

/**
 * Backspace at the start of a container's body removes the container shell and
 * keeps its body as ordinary blocks, instead of joining the body into the opening fence.
 * @param state - Canonical source draft.
 * @returns The unwrap, or null outside a container's first body row.
 */
export function unwrapContainer(state: EditorState): TransactionSpec | null {
  const head = caret(state);
  if (head === null) return null;
  const block = topBlock(state, Math.min(head + 1, state.doc.length));
  if (block?.name !== "CustomContainer" || block.getChildren("ContainerMark").length !== 2) return null;
  const open = state.doc.lineAt(block.from), close = state.doc.lineAt(block.to);
  if (close.number < open.number + 2 || head !== open.to + 1) return null;
  return { changes: [{ from: open.from, to: open.to + 1 }, { from: close.from - 1, to: close.to }], selection: EditorSelection.cursor(open.from) };
}

/** @param view - Mounted editor. @param block - Top-level block. @returns Whether the block has no text caret position: a thematic break or a rendered preview widget. */
export function opaque(view: EditorView, block: SyntaxNode): boolean {
  if (block.name === "HorizontalRule") return true;
  const end = contentEnd(view.state, block), { type } = view.lineBlockAt(end);
  // A rendered preview replaces the source with one non-empty widget range.
  return Array.isArray(type) ? type.some(part => part.type === BlockType.WidgetRange && part.from < part.to && part.from <= end && end <= part.to)
    : type === BlockType.WidgetRange;
}

/**
 * @param view - Mounted geometry. @param head - Caret. @param line - Caret line. @param forward - Edge side.
 * @returns Whether the caret is painted at that edge of its line, so hidden syntax there counts as the edge.
 */
function atVisualEdge(view: EditorView, head: number, line: Line, forward: boolean): boolean {
  const edge = forward ? line.to : line.from;
  if (head === edge) return true;
  const caret = view.coordsAtPos(head, forward ? -1 : 1), end = view.coordsAtPos(edge, forward ? -1 : 1);
  return !!caret && !!end && Math.round(caret.left) === Math.round(end.left) && Math.round(caret.top) === Math.round(end.top);
}

/**
 * Left/Right at a text edge next to a block without a text caret position
 * jumps over it to the nearest text on the other side, as Up/Down already do,
 * instead of stopping on its hidden source or on the collapsed separator.
 * @param forward - Moving right.
 * @returns A key handler that reports whether it moved the caret.
 */
export function skipOpaqueBlock(forward: boolean): (view: EditorView) => boolean {
  return view => {
    const state = view.state, head = caret(state);
    if (head === null) return false;
    const line = state.doc.lineAt(head);
    if (!atVisualEdge(view, head, line, forward) || blank(line)) return false;
    const block = neighbor(state, line, forward ? 1 : -1);
    if (!block || !opaque(view, block)) return false;
    const target = neighbor(state, state.doc.lineAt(forward ? block.to : block.from), forward ? 1 : -1);
    const position = target ? (forward ? state.doc.lineAt(target.from).from : state.doc.lineAt(target.to).to) : head;
    // Geometry is read here; the move itself goes through the command channel.
    const spec = { selection: EditorSelection.cursor(position), userEvent: "select", scrollIntoView: true };
    return commandKeyBinding(forward ? "ArrowRight" : "ArrowLeft", () => spec).run!(view);
  };
}

/**
 * Text typed at the edge of a block without a text caret position would land in
 * its hidden source or in the separator beside it; it opens a paragraph next to
 * the block instead, after it at its end and before it at its start.
 * @param view - Mounted editor. @param text - Typed text, or empty to only open the paragraph.
 * @returns The edit, or null when the caret is not at such an edge.
 */
export function typeBesideOpaqueBlock(view: EditorView, text: string): TransactionSpec | null {
  const state = view.state, head = caret(state);
  if (head === null) return null;
  const line = state.doc.lineAt(head);
  if (blank(line)) return null;
  const block = head === line.to ? topBlock(state, head) : head === line.from ? topBlock(state, head + 1) : null;
  if (!block || !opaque(view, block)) return null;
  if (head === state.doc.lineAt(block.to).to) {
    return { changes: { from: head, insert: `\n\n${text}` }, selection: EditorSelection.cursor(head + 2 + text.length), scrollIntoView: true, userEvent: "input.type" };
  }
  if (head !== state.doc.lineAt(block.from).from) return null;
  return { changes: { from: head, insert: `${text}\n\n` }, selection: EditorSelection.cursor(head + text.length), scrollIntoView: true, userEvent: "input.type" };
}

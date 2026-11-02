import { syntaxTree, syntaxTreeAvailable } from "@quirekit/cm-language";
import type { EditorState } from "@quirekit/cm-state";
import type { SyntaxNode } from "@lezer/common";
import type { ListContext } from "./types";

/** @param node - Accepted node at a selection endpoint. @returns Nearest item ancestor; code inside an item belongs to the code block. */
function itemAt(node: SyntaxNode | null): SyntaxNode | null {
  while (node && node.name !== "ListItem") {
    if (node.name === "FencedCode" || node.name === "CodeBlock") return null;
    node = node.parent;
  }
  return node;
}

/** @param tree - Current syntax tree. @param pos - Selection endpoint. @returns Innermost item on either side; a line end touches its nested item and the enclosing list. */
function innermostItem(tree: ReturnType<typeof syntaxTree>, pos: number): SyntaxNode | null {
  const after = itemAt(tree.resolveInner(pos, 1)), before = itemAt(tree.resolveInner(pos, -1));
  if (!after || !before) return after ?? before;
  return before.from >= after.from && before.to <= after.to ? before : after;
}

/** @param state - Canonical source. @param enumerate - Explicit actions enumerate affected siblings; status reads endpoints only. @returns Common sibling selection without walking descendants. */
export function listContext(state: EditorState, enumerate = true): ListContext | null {
  if (state.selection.ranges.length !== 1) return null;
  const range = state.selection.main, tree = syntaxTree(state);
  let first = innermostItem(tree, range.from);
  const end = range.empty ? range.to : range.to - 1;
  while (first?.parent && end > first.parent.to) first = itemAt(first.parent.parent);
  const list = first?.parent;
  if (!first || !list || !syntaxTreeAvailable(state, Math.min(state.doc.length, list.to + 1))) return null;
  const last = list.childBefore(end + 1);
  if (!last || last.name !== "ListItem" || end > last.to) return null;
  const items = enumerate ? [] : first.from === last.from ? [first] : [first, last];
  if (enumerate) for (let item: SyntaxNode | null = first; item && item.from <= end; item = item.nextSibling) {
    if (item.name === "ListItem") items.push(item);
  }
  let quotes = 0;
  for (let parent = list.parent; parent; parent = parent.parent) if (parent.name === "Blockquote") quotes++;
  for (const item of items) {
    const line = state.doc.lineAt(item.from), marker = item.getChild("ListMark");
    if (!marker || /\S/u.test(state.sliceDoc(line.from + listIndentStart(line.text, quotes), marker.from))) return null;
  }
  return { list, items, parent: list.parent?.name === "ListItem" ? list.parent : null, quotes };
}

/** @param item - Current item. @returns Previous sibling item, skipping container markers. */
export function previousListItem(item: SyntaxNode): SyntaxNode | null {
  let previous = item.prevSibling;
  while (previous && previous.name !== "ListItem") previous = previous.prevSibling;
  return previous;
}

/** @param line - Exact canonical line. @param quotes - Enclosing quote levels. @returns Start of list-owned indentation, preserving enclosing quote markers. */
export function listIndentStart(line: string, quotes: number): number {
  let from = 0;
  for (let index = 0; index < quotes; index++) {
    const prefix = /^[ \t]*>[ \t]?/u.exec(line.slice(from));
    if (!prefix) break;
    from += prefix[0].length;
  }
  return from;
}

/** @param state - Canonical source. @param item - Confirmed list item. @returns Width from marker to body, excluding task syntax. */
export function markerWidth(state: EditorState, item: SyntaxNode): number {
  const marker = item.getChild("ListMark")!;
  const line = state.doc.lineAt(marker.to);
  const spaces = /^[ \t]+/u.exec(state.sliceDoc(marker.to, line.to))?.[0] ?? " ";
  return marker.to - marker.from + (spaces.includes("\t") ? 4 - (marker.to - line.from) % 4 : Math.min(4, spaces.length));
}

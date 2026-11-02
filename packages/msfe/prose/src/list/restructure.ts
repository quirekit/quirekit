import type { ChangeSpec, EditorState, Line } from "@quirekit/cm-state";
import type { SyntaxNode } from "@lezer/common";
import { listIndentStart, previousListItem } from "./context";
import type { ListContext } from "./types";

/** @param item - List item. @returns Following sibling items in the same list. */
function itemsAfter(item: SyntaxNode): SyntaxNode[] {
  const items: SyntaxNode[] = [];
  for (let next = item.nextSibling; next; next = next.nextSibling) if (next.name === "ListItem") items.push(next);
  return items;
}

/** @param state - Canonical source. @param item - List item. @returns Ordered marker digits and delimiter, or null for bullets. */
function ordinal(state: EditorState, item: SyntaxNode): { readonly from: number; readonly digits: string; readonly delimiter: string } | null {
  const marker = item.getChild("ListMark");
  if (item.parent?.name !== "OrderedList" || !marker) return null;
  const match = /^(\d+)(.)/u.exec(state.sliceDoc(marker.from, marker.to));
  return match ? { from: marker.from, digits: match[1]!, delimiter: match[2]! } : null;
}

/** @param state - Canonical source. @param item - List item. @returns Author number of an ordered item, or 0. */
function numberOf(state: EditorState, item: SyntaxNode): number {
  return Number(ordinal(state, item)?.digits ?? 0);
}

/**
 * Writes consecutive numbers on ordered items. A number needing more digits is
 * skipped: the wider marker would move the item's content column past its
 * continuation lines and detach them.
 * @param state - Canonical source. @param items - Items in final order. @param start - Number of the first item.
 * @returns Marker digit replacements.
 */
function renumber(state: EditorState, items: readonly SyntaxNode[], start: number): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  items.forEach((item, index) => {
    const mark = ordinal(state, item), digits = String(start + index);
    if (mark && digits !== mark.digits && digits.length <= mark.digits.length) changes.push({ from: mark.from, to: mark.from + mark.digits.length, insert: digits });
  });
  return changes;
}

/** @param state - Canonical source. @param list - Existing list. @param item - Incoming item. @returns Whether the item continues the list instead of starting a new one. */
function joins(state: EditorState, list: SyntaxNode | null | undefined, item: SyntaxNode): boolean {
  if (!list || list.name !== item.parent?.name) return false;
  return list.name !== "OrderedList" || ordinal(state, list.firstChild!)?.delimiter === ordinal(state, item)?.delimiter;
}

/**
 * Keeps ordered numbering consecutive across one structural move, because
 * source and live modes show the author's numbers rather than derived ones.
 * @param state - Canonical source before the move. @param context - Moved items. @param direction - Nest or lift.
 * @returns Marker edits for the moved items, the siblings they leave and the list they enter.
 */
export function renumberMove(state: EditorState, context: ListContext, direction: 1 | -1): ChangeSpec[] {
  const items = context.items, first = items[0]!, after = itemsAfter(items.at(-1)!);
  if (direction > 0) {
    const previous = previousListItem(first)!, tail = previous.lastChild;
    const start = joins(state, tail, first) ? numberOf(state, tail!.lastChild!) + 1 : 1;
    return [...renumber(state, items, start), ...renumber(state, after, numberOf(state, previous) + 1)];
  }
  if (!context.parent) {
    const previous = previousListItem(first);
    return renumber(state, after, previous ? numberOf(state, previous) + 1 : numberOf(state, first));
  }
  // Siblings after the lifted items stay indented and become their last item's new nested list.
  const outer = context.parent.parent, changes = renumber(state, after, 1);
  if (!joins(state, outer, first)) return [...changes, ...renumber(state, items, 1)];
  const start = numberOf(state, context.parent) + 1;
  return [...changes, ...renumber(state, items, start), ...renumber(state, itemsAfter(context.parent), start + items.length)];
}

/**
 * Blank lines that keep unwrapped root items as their own paragraphs.
 * Without them a paragraph line directly after an item is a lazy continuation
 * of that item, and a following ordered item cannot interrupt the paragraph.
 * @param state - Canonical source. @param context - Root list being unwrapped.
 * @returns Insertions before each unwrapped item and after the last one, inside the list's container.
 */
export function separateUnwrapped(state: EditorState, context: ListContext): ChangeSpec[] {
  const container = context.list.parent, doc = state.doc, changes: ChangeSpec[] = [];
  const from = container?.name === "Document" ? 0 : container?.from ?? 0, to = container?.name === "Document" ? doc.length : container?.to ?? doc.length;
  const blank = (line: Line) => !/\S/u.test(line.text.slice(listIndentStart(line.text, context.quotes)));
  const prefix = (line: Line) => line.text.slice(0, listIndentStart(line.text, context.quotes)).trimEnd();
  for (const item of context.items) {
    const line = doc.lineAt(item.from);
    if (line.number === 1) continue;
    const before = doc.line(line.number - 1);
    if (before.from >= from && !blank(before)) changes.push({ from: before.to, insert: "\n" + prefix(line) });
  }
  const last = doc.lineAt(context.items.at(-1)!.to);
  if (last.number < doc.lines) {
    const after = doc.line(last.number + 1);
    if (after.to <= to && !blank(after)) changes.push({ from: last.to, insert: "\n" + prefix(last) });
  }
  return changes;
}

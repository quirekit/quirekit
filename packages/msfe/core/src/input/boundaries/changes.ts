import { EditorSelection, StateEffect, Transaction, type ChangeSpec, type EditorState, type Line, type TransactionSpec } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import { changeOrigin } from "../../state/fields";
import { boundariesActive, boundariesAt, boundariesBetween } from "./registry";
import { editingCursor, outsideBlock } from "./selection";
import type { EditingBoundary } from "./types";

/** @param state - Original source. @param boundary - Confirmed owner. @returns Shell intervals including the line breaks required to keep a block structurally separate. */
function shell(state: EditorState, boundary: EditingBoundary): readonly (readonly [number, number])[] {
  if (boundary.kind === "atom" || boundary.kind === "syntax") return [[boundary.from, boundary.to]];
  // A block keeps its whole blank separator from preceding text, not only one of its line breaks.
  const opening = state.doc.lineAt(boundary.from), before = opening.number > 1 ? state.doc.line(opening.number - 1) : null;
  const separated = before && before.number > 1 && !/\S/u.test(before.text) ? before.from - 1 : opening.from - 1;
  const from = boundary.kind === "block" ? Math.max(0, separated) : boundary.from;
  const to = boundary.kind === "block" ? Math.min(state.doc.length, state.doc.lineAt(boundary.to).to + 1) : boundary.to;
  return [[from, boundary.contentFrom], [boundary.contentTo, to]].filter(([from, to]) => from! < to!) as [number, number][];
}

/** @param ranges - Deletion intervals. @returns Sorted disjoint intervals, preserving adjacent edits as one change. */
function merge(ranges: readonly (readonly [number, number])[]): [number, number][] {
  const result: [number, number][] = [];
  for (const [from, to] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = result.at(-1);
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else if (from < to) result.push([from, to]);
  }
  return result;
}

/** @param from - Requested start. @param to - Requested end. @param protectedRanges - Hidden source to retain. @returns Editable subranges only. */
function subtract(from: number, to: number, protectedRanges: readonly (readonly [number, number])[]): [number, number][] {
  const result: [number, number][] = [];
  for (const [start, end] of merge(protectedRanges)) {
    if (end <= from || start >= to) continue;
    if (start > from) result.push([from, start]);
    from = Math.max(from, end);
  }
  if (from < to) result.push([from, to]);
  return result;
}

/**
 * Backspace or Delete that would only remove a style's hidden marker removes a
 * visible character instead, as rich editors do: the style's own last or first
 * character, or the character beside the style, whichever the key points at.
 * @param state - Source. @param owner - The style. @param closer - The native deletion touched the closing marker.
 * @param forward - Delete rather than Backspace.
 * @returns The deletion and the caret before it, or null to keep the default handling.
 */
function styleEdgeDeletion(state: EditorState, owner: EditingBoundary, closer: boolean, forward: boolean): { from: number; to: number; caret: number } | null {
  const line = state.doc.lineAt(owner.from), length = owner.contentTo - owner.contentFrom;
  if (closer === forward) owner = outermost(state, owner, forward);
  // Inside: the key points at the style's own text; an only character takes the whole style along.
  if (closer !== forward) {
    if (length <= 0) return null;
    const edge = forward ? owner.contentFrom : owner.contentTo;
    const size = forward ? charLength(state, edge, 1) : charLength(state, edge, -1);
    if (size >= length) return { from: owner.from, to: owner.to, caret: owner.from };
    return forward ? { from: edge, to: edge + size, caret: edge } : { from: edge - size, to: edge, caret: edge - size };
  }
  // Outside: within a line of text. A paragraph starting with the style joins the text above it; at the
  // start of other blocks' text and at the end of a line the style is unwrapped as before.
  if (forward ? owner.to >= line.to : false) return null;
  const before = state.sliceDoc(line.from, owner.from);
  if (!forward && !before && line.number > 1) return joinAbove(state, line, owner);
  if (!forward && /^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|#{1,6}\s+)?$/u.test(before)) return null;
  const size = charLength(state, forward ? owner.to : owner.from, forward ? 1 : -1);
  return forward ? { from: owner.to, to: owner.to + size, caret: owner.contentTo } : { from: owner.from - size, to: owner.from, caret: owner.contentFrom };
}

/**
 * @param state - Source. @param owner - Style. @param forward - Looking past its end rather than its start.
 * @returns The outermost style whose hidden marker sits right outside this one, so the character beside it is visible text.
 */
function outermost(state: EditorState, owner: EditingBoundary, forward: boolean): EditingBoundary {
  for (;;) {
    const edge = forward ? owner.to : owner.from;
    const outer = boundariesAt(state, edge).find(value => value.kind === "style" && (forward ? value.contentTo === edge && value.to > edge : value.contentFrom === edge && value.from < edge));
    if (!outer) return owner;
    owner = outer;
  }
}

/** @param state - Source. @param at - Position. @param direction - Forward or backward. @returns UTF-16 length of the character there, keeping surrogate pairs whole. */
function charLength(state: EditorState, at: number, direction: 1 | -1): number {
  const pair = direction > 0 ? state.sliceDoc(at, at + 2) : state.sliceDoc(at - 2, at);
  return pair.length === 2 && pair.codePointAt(0)! > 0xffff ? 2 : 1;
}

/**
 * @param state - Source. @param line - Paragraph line starting with the style. @param owner - The style.
 * @returns The join of this paragraph to the end of the paragraph or heading text above it, or null for other blocks above.
 */
function joinAbove(state: EditorState, line: Line, owner: EditingBoundary): { from: number; to: number; caret: number } | null {
  let above = state.doc.line(line.number - 1);
  while (above.number > 1 && !/\S/u.test(above.text)) above = state.doc.line(above.number - 1);
  if (!/\S/u.test(above.text)) return null;
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(above.to, -1);
  while (node && !/^(?:Paragraph|ATXHeading[1-6])$/u.test(node.name)) node = node.parent;
  return node && node.parent?.name === "Document" && node.to === above.to ? { from: above.to, to: owner.from, caret: owner.contentFrom } : null;
}

/** @param transaction - Native input candidate. @returns The complete accepted source plan, retaining annotations and mapped effects without a delete/reinsert repair. */
export function boundaryInputCorrection(transaction: Transaction): TransactionSpec | null {
  const state = transaction.startState, event = transaction.annotation(Transaction.userEvent);
  if (!transaction.docChanged || !boundariesActive(state) || state.readOnly || transaction.annotation(changeOrigin)
    || !(event?.startsWith("delete") || event?.startsWith("input.")) || event.startsWith("input.type.compose")) return null;
  const deletions: [number, number][] = [], insertions: { from: number; insert: string }[] = [];
  const targets: { from: number; to: number; position: number; inserted: number }[] = [];
  const selectedObjects: { from: number; to: number }[] = [];
  let corrected = false;
  transaction.changes.iterChanges((from, to, _newFrom, _newTo, inserted) => {
    let position = from;
    const text = inserted.toString(), protect: (readonly [number, number])[] = [];
    const owners = boundariesBetween(state, from, to);
    const collapsed = state.selection.ranges.some(range => range.empty && range.head >= from && range.head <= to);
    let reach = to;
    for (const owner of owners) {
      if (owner.kind === "separator" || owner.deletion === "native") continue;
      // Firefox writes typing after a style's closer into the style's text node;
      // the caret was after the closer, so the text belongs there.
      if (owner.kind === "style" && text && from === to && from === owner.contentTo
        && state.selection.ranges.some(range => range.empty && range.head === owner.to)) {
        position = reach = owner.to; corrected = true;
        continue;
      }
      const covered = state.selection.ranges.some(range => !range.empty && range.from <= (owner.selectFrom ?? owner.from) && range.to >= (owner.selectTo ?? owner.to));
      if (covered) continue;
      // A deletion from an earlier line joins this line's text to that line: its prefix goes with the line break.
      if (owner.kind === "prefix" && from < state.doc.lineAt(owner.from).from && to >= owner.contentFrom) continue;
      const intervals = shell(state, owner);
      if (owner.kind === "style" && !text && from <= owner.contentFrom && to >= owner.contentTo) {
        deletions.push(...intervals.map(([a, b]): [number, number] => [a, b])); corrected = true;
        continue;
      }
      const touches = intervals.some(([a, b]) => from < b && to > a || from === to && position > a && position < b);
      if (!touches) continue;
      corrected = true;
      if (owner.kind === "atom") {
        protect.push(...intervals);
        if (collapsed && !text) selectedObjects.push(owner);
        if (position > owner.from && position < owner.to) position = owner.to;
        continue;
      }
      const onlyShell = !text && (to <= owner.contentFrom || from >= owner.contentTo);
      const step = collapsed && onlyShell && owner.kind === "style" ? styleEdgeDeletion(state, owner, from >= owner.contentTo, !!event?.startsWith("delete.forward")) : null;
      if (step) {
        deletions.push([step.from, step.to]);
        protect.push(...intervals, [from, to]);
        position = step.caret;
        continue;
      }
      if (collapsed && onlyShell && owner.deletion === "unwrap") {
        deletions.push(...intervals.map(([a, b]): [number, number] => [a, b]));
        position = owner.contentFrom;
        protect.push([from, to]);
        continue;
      }
      protect.push(...intervals);
      if (collapsed && owner.kind === "syntax") {
        position = event?.startsWith("delete.forward") ? owner.to : owner.from;
      } else if (collapsed && onlyShell && owner.kind === "block") {
        const forward = event?.startsWith("delete.forward") ?? false;
        position = editingCursor(state, EditorSelection.cursor(outsideBlock(state, owner, forward)), forward ? 1 : -1).head;
      } else if (position >= owner.from && position < owner.contentFrom) position = owner.contentFrom;
      else if (position > owner.contentTo && position <= owner.to) position = owner.contentTo;
    }
    deletions.push(...subtract(from, to, protect));
    if (text) insertions.push({ from: position, insert: text });
    targets.push({ from, to: reach, position, inserted: text.length });
  });
  if (!corrected) return null;
  // Retained source shells split a native replacement into disjoint edits. Apply
  // the complete plan once; never dispatch a partial range or serialize the doc.
  const changes: ChangeSpec[] = merge(deletions).map(([from, to]) => ({ from, to }));
  changes.push(...insertions);
  const accepted = state.changes(changes);
  const ranges = state.selection.ranges.map(range => {
    const object = selectedObjects.find(value => range.head >= value.from && range.head <= value.to);
    if (object) return EditorSelection.range(accepted.mapPos(object.from, -1), accepted.mapPos(object.to, 1));
    const target = targets.find(value => range.head >= value.from && range.head <= value.to || !range.empty && range.from >= value.from && range.to <= value.to);
    // A replacement's old start maps before its new text even with positive
    // association. Advance from that mapped insertion start, including UTF-16.
    return target ? EditorSelection.cursor(target.inserted ? accepted.mapPos(target.position, -1) + target.inserted
      : accepted.mapPos(target.position, 1)) : range.map(accepted);
  });
  const correction = transaction.changes.invert(state.doc).compose(accepted);
  return { changes: accepted, selection: EditorSelection.create(ranges, state.selection.mainIndex),
    effects: StateEffect.mapEffects(transaction.effects, correction), annotations: transaction.annotations, scrollIntoView: transaction.scrollIntoView };
}

import { EditorSelection, type ChangeSpec, type EditorState, type SelectionRange } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import { validMarkChange } from "./validation";
import type { SourceMarkFormat, SourceMarkPlan, SourceMarkSpan } from "./types";

/** @param state - Source. @param edits - Proposed edits. @param range - Original directed selection. @returns The selection covering the same text after the edits. */
function mappedSelection(state: EditorState, edits: readonly ChangeSpec[], range: SelectionRange): SelectionRange {
  const changes = state.changes(edits), low = changes.mapPos(range.from, 1), high = changes.mapPos(range.to, -1);
  return EditorSelection.range(range.anchor <= range.head ? low : high, range.anchor <= range.head ? high : low);
}

/**
 * Removes a style from only the selected part of its text, as rich editors do,
 * by closing it before the selection and opening it again after.
 * @param state - Source. @param range - Selection inside the style's text. @param active - The style. @param spans - All spans of the owner. @param format - Feature grammar.
 * @returns The plan, or null when the split would change other semantics.
 */
export function splitMark(state: EditorState, range: SelectionRange, active: SourceMarkSpan, spans: readonly SourceMarkSpan[], format: SourceMarkFormat): SourceMarkPlan | null {
  const marker = state.sliceDoc(active.node.from, active.from), closer = state.sliceDoc(active.to, active.node.to);
  const edits: ChangeSpec[] = range.from <= active.from ? [{ from: active.node.from, to: active.from }, { from: range.to, insert: marker }]
    : range.to >= active.to ? [{ from: range.from, insert: closer }, { from: active.to, to: active.node.to }]
      : [{ from: range.from, insert: closer }, { from: range.to, insert: marker }];
  const selected = mappedSelection(state, edits, range);
  return validMarkChange(state, state.changes(edits), selected, spans, format, active)
    ? { changes: edits, range: selected, from: active.node.from, to: active.node.to } : null;
}

/**
 * Extends styles the selection overlaps or contains so one style covers the whole
 * selection, merging every same-format span it touches.
 * @param state - Source. @param range - Nonempty selection. @param spans - All spans of the owner. @param format - Feature grammar.
 * @returns The plan, null when nothing overlaps, or false when merging would change other semantics.
 */
export function mergeMarks(state: EditorState, range: SelectionRange, spans: readonly SourceMarkSpan[], format: SourceMarkFormat): SourceMarkPlan | false | null {
  const same = spans.filter(span => span.node.name === format.node && span.node.firstChild?.name === format.markerNode
    && span.node.from < range.to && range.from < span.node.to);
  if (!same.length) return null;
  const from = Math.min(range.from, ...same.map(span => span.node.from)), to = Math.max(range.to, ...same.map(span => span.node.to));
  const edits: ChangeSpec[] = [];
  for (const span of same) {
    if (span.node.from !== from) edits.push({ from: span.node.from, to: span.from });
    if (span.node.to !== to) edits.push({ from: span.to, to: span.node.to });
  }
  if (!same.some(span => span.node.from === from)) edits.push({ from, insert: format.marker });
  if (!same.some(span => span.node.to === to)) edits.push({ from: to, insert: format.marker });
  // The merged style's text, markers excluded, is what stays selected.
  const changes = state.changes(edits), length = format.marker.length;
  const textFrom = Math.max(changes.mapPos(range.from, 1), changes.mapPos(from, -1) + length);
  const textTo = Math.min(changes.mapPos(range.to, -1), changes.mapPos(to, 1) - length);
  const selected = EditorSelection.range(range.anchor <= range.head ? textFrom : textTo, range.anchor <= range.head ? textTo : textFrom);
  return validMarkChange(state, changes, selected, spans, format) ? { changes: edits, range: selected, from, to } : false;
}

/**
 * @param spans - Spans of the owner. @param range - Selection. @param format - Feature grammar.
 * @returns The same selection, or the text of a same-format style when the selection is exactly that whole style.
 */
export function styleText(spans: readonly SourceMarkSpan[], range: SelectionRange, format: SourceMarkFormat): SelectionRange {
  const whole = spans.find(span => span.node.name === format.node && span.node.from === range.from && span.node.to === range.to);
  return whole ? EditorSelection.range(range.anchor <= range.head ? whole.from : whole.to, range.anchor <= range.head ? whole.to : whole.from) : range;
}

/** @param state - Source. @param range - Selection crossing blocks. @returns The selection's part in each paragraph, heading or table cell it crosses. */
export function blockParts(state: EditorState, range: SelectionRange): SelectionRange[] {
  const parts: SelectionRange[] = [];
  syntaxTree(state).iterate({ from: range.from, to: range.to, enter(node) {
    if (!/^(?:Paragraph|TableCell|ATXHeading[1-6]|SetextHeading[12])$/u.test(node.name)) return;
    const mark = node.name.startsWith("ATX") ? node.node.getChild("HeaderMark") : null;
    const textFrom = mark ? Math.min(node.to, mark.to + Number(state.sliceDoc(mark.to, mark.to + 1) === " ")) : node.from;
    const textTo = node.name.startsWith("Setext") ? state.doc.lineAt(node.from).to : node.to;
    const from = Math.max(range.from, textFrom), to = Math.min(range.to, textTo);
    if (from < to && /\S/u.test(state.sliceDoc(from, to))) parts.push(EditorSelection.range(from, to));
    return false;
  } });
  return parts;
}

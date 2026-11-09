import { EditorSelection, type EditorState, type SelectionRange } from "@quirekit/cm-state";
import type { MsfeCommand } from "../../state/types";
import { inlineSpans, querySourceInline } from "./context";
import { validMarkChange } from "./validation";
import { blockParts, mergeMarks, splitMark, styleText } from "./spread";
import { inEmptyPair, pendingMarkEffect } from "./pending";
import { closesStyleLine, STYLE_EXIT } from "../../input/boundaries/selection";
import type { SourceMarkFormat, SourceMarkPlan } from "./types";

/** @param state - Accepted source. @param range - One directed selection. @param format - Feature grammar. @returns An unpublished semantic edit, or refusal. */
function plan(state: EditorState, range: SelectionRange, format: SourceMarkFormat): SourceMarkPlan | null {
  // A second toggle in the empty pair the first one left cancels it.
  if (range.empty && inEmptyPair(state, range.from, format.marker)) {
    const length = format.marker.length;
    return { changes: [{ from: range.from - length, to: range.from + length }], range: EditorSelection.cursor(range.from - length), from: range.from, to: range.from };
  }
  const query = querySourceInline(state, range), owner = query.node;
  if (!owner && !query.reason && range.empty) return { changes: [{ from: range.from, insert: format.marker + format.marker }],
    range: EditorSelection.cursor(range.from + format.marker.length), from: range.from, to: range.to };
  if (!owner || owner.to - owner.from > 20_000) return null;
  const spans = inlineSpans(owner);
  // A selection of a whole style, markers included, means its text.
  const text = range.empty ? range : styleText(spans, range, format);
  if (text !== range) return plan(state, text, format);
  let from = range.from, to = range.to;
  // Whole-body selection includes hidden syntax shells. Expand inside-out before
  // testing an outer format against the actual surrounding delimiter context.
  for (const span of [...spans].sort((a, b) => a.node.to - a.node.from - (b.node.to - b.node.from))) {
    if (!range.empty && from === span.from && to === span.to) { from = span.node.from; to = span.node.to; }
  }
  const active = spans.filter(span => span.node.name === format.node && span.node.firstChild?.name === format.markerNode
    && span.from <= range.from && span.to >= range.to).sort((a, b) => a.to - a.from - (b.to - b.from))[0];
  if (active && !range.empty && !(from <= active.node.from && to >= active.node.to)) return splitMark(state, range, active, spans, format);
  if (!active && !range.empty) {
    const merged = mergeMarks(state, range, spans, format);
    if (merged !== null) return merged || null;
  }
  // At the end of a style's text, a collapsed toggle stops the style for what follows instead of removing it.
  if (active && range.empty && range.from === active.to) {
    const after = closesStyleLine(state, active.node.from, active.node.to) ? state.doc.lineAt(active.node.to).to : active.node.to;
    return { changes: [], range: EditorSelection.cursor(after, 1), from: active.node.from, to: active.node.to };
  }
  // A range must not split a paired owner. Complete nested marks remain legal.
  if (spans.some(span => span.node.from < from && from < span.from || span.to < to && to < span.node.to
    || from < span.node.from && span.node.from < to && to < span.node.to
    || span.node.from < from && from < span.node.to && span.node.to < to)) return null;
  const edits = active ? [{ from: active.node.from, to: active.from }, { from: active.to, to: active.node.to }]
    : from === to ? [{ from, insert: format.marker + format.marker }]
      : [{ from, insert: format.marker }, { from: to, insert: format.marker }];
  const changes = state.changes(edits);
  const low = changes.mapPos(range.from, 1), high = changes.mapPos(range.to, -1);
  const selected = !active && range.empty ? EditorSelection.cursor(from + format.marker.length)
    : EditorSelection.range(range.anchor <= range.head ? low : high, range.anchor <= range.head ? high : low);
  if ((!range.empty || active) && !validMarkChange(state, changes, selected, spans, format, active)) return null;
  return { changes: edits, range: selected, from: active?.node.from ?? from, to: active?.node.to ?? to };
}

/**
 * A selection across blocks formats its part in each block: every part gets the
 * style unless all of them already have it, in which case it is removed from all.
 * @param state - Accepted source. @param range - Selection crossing blocks. @param format - Feature grammar.
 * @returns One combined plan, or refusal when any part cannot change.
 */
function spreadPlan(state: EditorState, range: SelectionRange, format: SourceMarkFormat): SourceMarkPlan | null {
  const parts = blockParts(state, range).map(part => {
    const owner = querySourceInline(state, part).node;
    return owner ? styleText(inlineSpans(owner), part, format) : part;
  });
  if (parts.length < 2) return null;
  const covered = (part: SelectionRange) => {
    const owner = querySourceInline(state, part).node;
    return !!owner && inlineSpans(owner).some(span => span.node.name === format.node && span.from <= part.from && span.to >= part.to);
  };
  const remove = parts.every(covered), plans = parts.filter(part => remove || !covered(part)).map(part => plan(state, part, format));
  if (plans.some(value => !value)) return null;
  const edits = plans.flatMap(value => value!.changes), changes = state.changes(edits);
  const low = changes.mapPos(range.from, 1), high = changes.mapPos(range.to, -1);
  return { changes: edits, range: EditorSelection.range(range.anchor <= range.head ? low : high, range.anchor <= range.head ? high : low), from: range.from, to: range.to };
}

/**
 * Toggles a parser-confirmed format without replacing Markdown with another document model.
 * @param format - Owning feature's syntax and source spelling.
 * @returns A pure atomic command; unsafe combinations leave source and history unchanged.
 */
export function toggleSourceMark(format: SourceMarkFormat): MsfeCommand {
  if (!format.node || !format.markerNode || !format.marker || /\s/u.test(format.marker)) throw new Error("invalid-source-mark");
  return state => {
    const plans = state.selection.ranges.map(range => querySourceInline(state, range).reason === "selection" ? spreadPlan(state, range, format) : plan(state, range, format));
    if (plans.some(value => !value)) return null;
    for (let index = 1; index < plans.length; index++) if (plans[index]!.from <= plans[index - 1]!.to) return null;
    let index = 0;
    const exits = plans.every(value => !value!.changes.length);
    const pending = plans.length === 1 && state.selection.main.empty && plans[0]!.changes.length === 1
      && "insert" in plans[0]!.changes[0]! && plans[0]!.changes[0]!.insert === format.marker + format.marker;
    // Stopping a style leaves the caret after its closer, where navigation would otherwise put it back inside.
    return { ...state.changeByRange(() => plans[index++]!), ...(exits ? { userEvent: STYLE_EXIT } : {}),
      ...(pending ? { effects: pendingMarkEffect.of({ at: plans[0]!.range.head, marker: format.marker }) } : {}) };
  };
}

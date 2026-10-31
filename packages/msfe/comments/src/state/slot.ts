import { defineEffect, defineState, SourceRangeSet, type SourceRange } from "@quirekit/msfe-core";
import type { ChangeDesc, StateEffect, Transaction } from "@quirekit/cm-state";
import { invertedEffects } from "@quirekit/cm-commands";
import type { CommentOperation, CommentPlacement, CommentsState } from "./types";

/** Typing at either edge stays outside; a deleted quote collapses to a point instead of vanishing. */
const POLICY = { inclusiveStart: false, inclusiveEnd: false, onDelete: "keep" } as const;

/** @param placement - Range in some coordinates. @param changes - Later changes. @returns Same range in later coordinates. */
function mapPlacement(placement: CommentPlacement, changes: ChangeDesc): CommentPlacement {
  const from = changes.mapPos(placement.from, 1), to = Math.max(from, changes.mapPos(placement.to, -1));
  return { id: placement.id, from, to };
}

/** @param operation - Stored operation, e.g. an inverse kept by history. @param changes - Later changes. @returns Remapped operation. */
function mapOperation(operation: CommentOperation, changes: ChangeDesc): CommentOperation {
  switch (operation.type) {
    case "load": case "place": case "sync": return { ...operation, placements: operation.placements.map(item => mapPlacement(item, changes)) };
    case "create": return operation.placement ? { ...operation, placement: mapPlacement(operation.placement, changes) } : operation;
    default: return operation;
  }
}

/** Comment changes; text-neutral, so they travel through readonly-safe view updates outside text history. */
export const commentsEffect = defineEffect<CommentOperation>(mapOperation);

/** @param placement - Requested range. @param length - Current source length. @returns Policy-bearing range, or null when out of bounds. */
function toRange(placement: CommentPlacement, length: number): SourceRange<string> | null {
  const { id, from, to } = placement;
  return Number.isSafeInteger(from) && Number.isSafeInteger(to) && from >= 0 && from <= to && to <= length ? { id, from, to, value: id, ...POLICY } : null;
}

/** @param ranges - Current ranges. @param placements - Replacements for existing threads. @param threads - Live threads. @param length - Source length. @returns Updated ranges. */
function placeRanges(ranges: SourceRangeSet<string>, placements: readonly CommentPlacement[], threads: CommentsState["threads"], length: number): SourceRangeSet<string> {
  const next = new Map(ranges.all().map(range => [range.id, range]));
  for (const placement of placements) {
    const range = threads.has(placement.id) ? toRange(placement, length) : null;
    if (range) next.set(range.id, range);
  }
  return SourceRangeSet.from([...next.values()]);
}

/**
 * @param state - Prior state with ranges already mapped.
 * @param operation - Remote changes in resulting coordinates.
 * @param length - Source length.
 * @returns State with remote threads merged; focus survives unless its thread was deleted.
 */
function sync(state: CommentsState, operation: Extract<CommentOperation, { type: "sync" }>, length: number): CommentsState {
  const threads = new Map(state.threads);
  for (const thread of operation.threads) threads.set(thread.id, thread);
  for (const id of operation.removed) threads.delete(id);
  const dropped = new Set([...operation.removed, ...operation.orphaned]);
  const kept = SourceRangeSet.from(state.ranges.all().filter(range => !dropped.has(range.id)));
  return { threads, ranges: placeRanges(kept, operation.placements, threads, length), active: state.active && threads.has(state.active) ? state.active : null };
}

/** @param state - Prior state with ranges already mapped. @param operation - Change in resulting coordinates. @param length - Source length. @returns Next state. */
function apply(state: CommentsState, operation: CommentOperation, length: number): CommentsState {
  switch (operation.type) {
    case "load": {
      const threads = new Map(operation.threads.map(thread => [thread.id, thread]));
      return { threads, ranges: placeRanges(SourceRangeSet.from<string>(), operation.placements, threads, length), active: null };
    }
    case "create": {
      // A document comment has no placement; an anchored one needs a valid range.
      if (state.threads.has(operation.thread.id) || operation.placement && !toRange(operation.placement, length)) return state;
      const threads = new Map(state.threads).set(operation.thread.id, operation.thread);
      return { ...state, threads, ranges: operation.placement ? placeRanges(state.ranges, [operation.placement], threads, length) : state.ranges };
    }
    case "update":
      return state.threads.has(operation.thread.id) ? { ...state, threads: new Map(state.threads).set(operation.thread.id, operation.thread) } : state;
    case "delete": {
      if (!state.threads.has(operation.id)) return state;
      const threads = new Map(state.threads); threads.delete(operation.id);
      return { threads, ranges: SourceRangeSet.from(state.ranges.all().filter(range => range.id !== operation.id)),
        active: state.active === operation.id ? null : state.active };
    }
    case "place": return { ...state, ranges: placeRanges(state.ranges, operation.placements, state.threads, length) };
    case "sync": return sync(state, operation, length);
    case "activate": return operation.id === null || state.threads.has(operation.id) ? { ...state, active: operation.id } : state;
  }
}

/**
 * Comment ranges collapsed or trimmed by a text edit come back when that edit is undone.
 * The inverse restores every range touching a changed interval, in pre-transaction coordinates.
 * @param value - State before the edit.
 * @param transaction - Forward transaction.
 * @returns Restoration effect, or nothing when no range was touched.
 */
function invert(value: CommentsState, transaction: Transaction): readonly StateEffect<unknown>[] {
  if (!transaction.docChanged) return [];
  const touched = new Map<string, CommentPlacement>();
  transaction.changes.iterChangedRanges((from, to) => {
    for (const range of value.ranges.between(from, to)) touched.set(range.id, { id: range.id, from: range.from, to: range.to });
  });
  return touched.size ? [commentsEffect.of({ type: "place", reason: "restore", placements: [...touched.values()] })] : [];
}

/** Installed comment state: ranges map through every edit, then operations apply in resulting coordinates. */
export const commentsState = defineState<CommentsState>({
  key: "comments",
  create: () => ({ threads: new Map(), ranges: SourceRangeSet.from<string>(), active: null }),
  /** @param value - Prior state. @param update - Accepted or draft transaction. @returns Next state, or the same object when untouched. */
  update(value, update) {
    const operations = update.effects(commentsEffect);
    if (!update.docChanged && !operations.length) return value;
    let state = update.docChanged ? { ...value, ranges: value.ranges.map(update.changes) } : value;
    for (const operation of operations) state = apply(state, operation, update.document.length);
    return state;
  },
});

/**
 * Range restoration for the built-in text history. Kept outside the state slot so the slot also installs under
 * collaboration, whose shared history cannot replay effects; the collaboration binding repairs ranges there instead.
 */
export const commentsHistory = invertedEffects.of(transaction => invert(commentsState.read(transaction.startState), transaction));

/**
 * Inverts comment operations carried by a recorded transaction. Comment writes from the sidebar are
 * view updates outside history, so this only covers operations inside command chains, such as an AI
 * write: undoing that write, or rejecting its review, takes its comments back with its text.
 * @param value - State before the transaction.
 * @param transaction - Forward transaction.
 * @returns Inverse operations in reverse order, in the coordinates after the transaction.
 */
function invertOperations(value: CommentsState, transaction: Transaction): readonly StateEffect<unknown>[] {
  const inverses: StateEffect<unknown>[] = [];
  for (const operation of commentsEffect.values(transaction)) {
    if (operation.type === "create") inverses.push(commentsEffect.of({ type: "delete", id: operation.thread.id }));
    else if (operation.type === "update") {
      const previous = value.threads.get(operation.thread.id);
      if (previous) inverses.push(commentsEffect.of({ type: "update", kind: operation.kind, thread: previous }));
    } else if (operation.type === "delete") {
      const previous = value.threads.get(operation.id);
      const range = value.ranges.all().find(item => item.id === operation.id);
      if (previous) inverses.push(commentsEffect.of({ type: "create", thread: previous,
        ...(range ? { placement: mapPlacement({ id: range.id, from: range.from, to: range.to }, transaction.changes) } : {}) }));
    }
  }
  return inverses.reverse();
}

/** Inverse of comment operations in recorded transactions, for undo and for taking an AI write back. */
export const commentsOperationHistory = invertedEffects.of(transaction => invertOperations(commentsState.read(transaction.startState), transaction));

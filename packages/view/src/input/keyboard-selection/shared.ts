import { Selection, TextSelection, type ResolvedPos, type Transaction } from "@quirekit/pm";
import type { QuireKeyboardSelectionTransactionOptions } from "./types";

/**
 * Collapses a non-empty selection for plain horizontal arrow movement.
 *
 * @param options - State and resolver options.
 * @param direction - Negative collapses to selection start, positive to selection end.
 * @returns Selection transaction, or null when the selection is already collapsed.
 */
export function collapseSelectionToHorizontalEdge(
  options: QuireKeyboardSelectionTransactionOptions,
  direction: -1 | 1
): Transaction | null {
  const { selection, doc } = options.state;
  const position = clampKeyboardSelectionPosition(options, direction < 0 ? selection.from : selection.to);
  return selection.empty ? null : options.state.tr.setSelection(Selection.near(doc.resolve(position), direction));
}

/**
 * Applies a collapsed selection near a document position.
 *
 * @param options - State and resolver options.
 * @param position - Requested document position.
 * @param bias - Bias used when resolving non-textblock boundaries.
 * @returns Selection transaction, or null when the selection is unchanged.
 */
export function setCollapsedSelection(
  options: QuireKeyboardSelectionTransactionOptions,
  position: number,
  bias: number
): Transaction | null {
  return applyChangedSelection(options, Selection.near(resolveKeyboardTarget(options, position, bias), bias));
}

/**
 * Applies a text selection with the current anchor and a new head position.
 *
 * @param options - State and resolver options.
 * @param head - New moving side of the selection.
 * @param bias - Bias used when resolving non-textblock boundaries.
 * @returns Selection transaction, or null when the selection is unchanged.
 */
export function setExtendedSelection(
  options: QuireKeyboardSelectionTransactionOptions,
  head: number,
  bias: number
): Transaction | null {
  const { state } = options;
  return applyChangedSelection(options, TextSelection.between(state.doc.resolve(state.selection.anchor), resolveKeyboardTarget(options, head, bias), bias));
}

/**
 * Constrains a keyboard target to the active body or story selection scope.
 *
 * @param options - Keyboard selection options carrying optional source boundaries.
 * @param position - Requested document position.
 * @returns Source-scoped or unchanged document position.
 */
export function clampKeyboardSelectionPosition(
  options: QuireKeyboardSelectionTransactionOptions,
  position: number
): number {
  const boundary = options.selectionScopeBoundary ?? options.storyCommandBoundary;
  return boundary === undefined ? position : Math.min(boundary.selectionTo, Math.max(boundary.selectionFrom, position));
}

/**
 * Builds a transaction only when keyboard movement changes the selection.
 * @param options - Keyboard state.
 * @param next - Candidate selection.
 * @returns Selection transaction, or null when the selection is unchanged.
 */
function applyChangedSelection(options: QuireKeyboardSelectionTransactionOptions, next: Selection): Transaction | null {
  return next.eq(options.state.selection) ? null : options.state.tr.setSelection(next);
}

/**
 * Resolves a scoped keyboard target outside any atomic inline node, such as a phonetic
 * guide: its text belongs to one object, so a caret inside would add typed text to it.
 *
 * @param options - Keyboard state and scope boundaries.
 * @param position - Requested document position.
 * @param bias - Negative leaves before the node, otherwise after it.
 * @returns Resolved in-range position outside every atomic inline ancestor.
 */
function resolveKeyboardTarget(options: QuireKeyboardSelectionTransactionOptions, position: number, bias: number): ResolvedPos {
  const { doc } = options.state;
  const $position = doc.resolve(Math.min(Math.max(clampKeyboardSelectionPosition(options, position), 0), doc.content.size));
  for (let depth = 1; depth <= $position.depth; depth += 1) {
    if ($position.node(depth).isInline && $position.node(depth).isAtom) {
      return doc.resolve(bias < 0 ? $position.before(depth) : $position.after(depth));
    }
  }
  return $position;
}

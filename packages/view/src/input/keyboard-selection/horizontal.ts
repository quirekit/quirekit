import { TextSelection, type Transaction } from "@quirekit/pm";
import {
  findNextQuireWordBoundary,
  findPreviousQuireWordBoundary,
  isWordNavigationShortcut
} from "../keyboard-navigation";
import {
  collapseSelectionToHorizontalEdge,
  clampKeyboardSelectionPosition,
  setCollapsedSelection,
  setExtendedSelection
} from "./shared";
import type { QuireKeyboardSelectionTransactionOptions } from "./types";
import { navigateLineBoundary } from "./boundary";
import { resolveTableHorizontalBoundaryPosition } from "./table-boundary";

/**
 * Handles horizontal arrow navigation, including word and line shortcuts.
 *
 * @param options - State, event, and resolver options.
 * @param direction - Negative moves left, positive moves right.
 * @returns Selection transaction, or null when movement is unavailable.
 */
export function dispatchHorizontalArrowKey(
  options: QuireKeyboardSelectionTransactionOptions,
  direction: -1 | 1
): Transaction | null {
  if (options.event.metaKey === true) {
    return navigateLineBoundary(
      options,
      direction < 0 ? "start" : "end",
      options.event.shiftKey === true
    );
  }

  if (isWordNavigationShortcut(options.event)) {
    return options.event.shiftKey === true
      ? extendSelectionToWordBoundary(options, direction)
      : moveSelectionToWordBoundary(options, direction);
  }

  return options.event.shiftKey === true
    ? extendSelection(options, direction)
    : moveSelection(options, direction);
}

/**
 * Moves a collapsed text selection by one document position.
 *
 * @param options - State and resolver options.
 * @param direction - Negative moves left, positive moves right.
 * @returns Selection transaction, or null when movement is unavailable.
 */
function moveSelection(
  options: QuireKeyboardSelectionTransactionOptions,
  direction: -1 | 1
): Transaction | null {
  const { selection, doc } = options.state;
  if (!selection.empty) return collapseSelectionToHorizontalEdge(options, direction);
  const tableBoundaryPosition = resolveTableHorizontalBoundaryPosition(options, direction);
  if (tableBoundaryPosition !== null) return setCollapsedSelection(options, tableBoundaryPosition, direction);
  // One position step; an atomic inline node is crossed whole by the shared target resolver.
  const nextPosition = clampKeyboardSelectionPosition(options, Math.min(Math.max(selection.from + direction, 0), doc.content.size));
  return nextPosition === selection.from ? null : setCollapsedSelection(options, nextPosition, direction);
}

/**
 * Moves or collapses the current selection to the nearest word boundary.
 *
 * @param options - State and resolver options.
 * @param direction - Negative moves left, positive moves right.
 * @returns Selection transaction, or null when no boundary is available.
 */
function moveSelectionToWordBoundary(
  options: QuireKeyboardSelectionTransactionOptions,
  direction: -1 | 1
): Transaction | null {
  const { selection } = options.state;

  if (!selection.empty) {
    return collapseSelectionToHorizontalEdge(options, direction);
  }

  const boundary = resolveWordBoundary(options, direction);

  if (boundary === null || boundary === selection.head) {
    return null;
  }

  return setCollapsedSelection(options, boundary, direction);
}

/**
 * Extends the current selection to the nearest word boundary.
 *
 * @param options - State and resolver options.
 * @param direction - Negative extends left, positive extends right.
 * @returns Selection transaction, or null when no boundary is available.
 */
function extendSelectionToWordBoundary(
  options: QuireKeyboardSelectionTransactionOptions,
  direction: -1 | 1
): Transaction | null {
  const boundary = resolveWordBoundary(options, direction);

  if (boundary === null) {
    return null;
  }

  return setExtendedSelection(options, boundary, direction);
}

/**
 * Resolves the nearest word boundary from the moving selection head.
 *
 * @param options - State and resolver options.
 * @param direction - Negative resolves previous boundary, positive next boundary.
 * @returns Document position for the boundary, or null outside a textblock.
 */
function resolveWordBoundary(
  options: QuireKeyboardSelectionTransactionOptions,
  direction: -1 | 1
): number | null {
  const { selection } = options.state;

  if (!(selection instanceof TextSelection) || !selection.$head.parent.isTextblock) {
    return null;
  }

  const textblockText = selection.$head.parent.textBetween(
    0,
    selection.$head.parent.content.size,
    "\n",
    "\uFFFC"
  );
  const localOffset = selection.$head.parentOffset;
  const boundaryOffset = direction < 0
    ? findPreviousQuireWordBoundary(textblockText, localOffset)
    : findNextQuireWordBoundary(textblockText, localOffset);

  return selection.$head.start() + boundaryOffset;
}

/**
 * Extends a text selection by one document position while preserving anchor.
 *
 * @param options - State and resolver options.
 * @param direction - Negative extends left, positive extends right.
 * @returns Selection transaction, or null when movement is unavailable.
 */
function extendSelection(
  options: QuireKeyboardSelectionTransactionOptions,
  direction: -1 | 1
): Transaction | null {
  const { selection, doc } = options.state;
  const nextHead = clampKeyboardSelectionPosition(
    options,
    Math.min(Math.max(selection.head + direction, 0), doc.content.size)
  );

  if (nextHead === selection.head) {
    return null;
  }

  return setExtendedSelection(options, nextHead, direction);
}

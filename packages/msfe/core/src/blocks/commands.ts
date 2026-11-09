import { EditorSelection, type EditorState, type ChangeSet } from "@quirekit/cm-state";
import type { MsfeCommand } from "../state/types";
import type { SourceBlock, SourceBlockSide } from "./types";
import { currentSourceBlock, sameSourceBlockScope, sourceBlockSibling } from "./query";
import { preservesSourceBlockScope } from "./scope";
import { sourceBlockInsertion } from "./separators";

/** @param state - Current source. @param block - Exact complete block. @returns Removal consuming one neighboring gap, without touching adjacent content. */
function removal(state: EditorState, block: SourceBlock): ChangeSet {
  const next = sourceBlockSibling(state, block, 1), previous = sourceBlockSibling(state, block, -1);
  return state.changes({ from: next ? block.from : previous?.to ?? block.from, to: next?.from ?? block.to });
}

/** @param block - Complete captured block. @returns One source deletion, validated again against the command draft. */
export function removeSourceBlock(block: SourceBlock): MsfeCommand {
  return state => {
    if (!currentSourceBlock(state, block)) return null;
    const changes = removal(state, block);
    if (!preservesSourceBlockScope(state, changes, block)) return null;
    return { changes, selection: EditorSelection.cursor(changes.mapPos(block.from, -1)), scrollIntoView: true };
  };
}

/** @param block - Explicit adjacent block. @param side - Source boundary. @param markdown - New complete Markdown; empty opens an empty paragraph. @returns One atomic source insertion; delimiters in the payload remain unchanged. */
export function insertSourceBlock(block: SourceBlock, side: SourceBlockSide, markdown: string): MsfeCommand {
  return state => {
    if (!currentSourceBlock(state, block) || markdown && !markdown.trim()) return null;
    const from = side === "before" ? block.from : block.to, value = sourceBlockInsertion(state, { from, to: from }, markdown, block.scope);
    const changes = state.changes({ from, insert: value.insert });
    if (!preservesSourceBlockScope(state, changes, block)) return null;
    return { changes, selection: EditorSelection.range(value.anchor, value.caret), scrollIntoView: true };
  };
}

/** @param block - Complete captured source block. @param markdown - Canonical replacement; empty leaves an empty paragraph. @returns One guarded replacement preserving sibling and container boundaries. */
export function replaceSourceBlock(block: SourceBlock, markdown: string): MsfeCommand {
  return state => {
    if (!currentSourceBlock(state, block) || markdown && !markdown.trim()) return null;
    const value = sourceBlockInsertion(state, block, markdown, block.scope);
    const changes = state.changes({ from: block.from, to: block.to, insert: value.insert });
    if (!preservesSourceBlockScope(state, changes, block)) return null;
    return { changes, selection: EditorSelection.range(value.anchor, value.caret), scrollIntoView: true };
  };
}

/**
 * Moves exact source, with one accepted transaction and one undo event through editor.run.
 * @param block - Source block captured when the gesture began.
 * @param target - Complete sibling at the final pointer position.
 * @param side - Before or after that sibling.
 * @returns A planner rejecting self/descendant/cross-flow and obsolete targets.
 */
export function moveSourceBlock(block: SourceBlock, target: SourceBlock, side: SourceBlockSide): MsfeCommand {
  return state => {
    if (!currentSourceBlock(state, block) || !currentSourceBlock(state, target)
      || !sameSourceBlockScope(block, target) || block.from === target.from) return null;
    const adjacent = sourceBlockSibling(state, block, side === "before" ? 1 : -1);
    if (adjacent?.from === target.from) return null;
    const source = state.sliceDoc(block.from, block.to), removed = removal(state, block);
    const position = removed.mapPos(side === "before" ? target.from : target.to, side === "before" ? 1 : -1);
    const draft = state.update({ changes: removed }).state;
    const scope = { from: removed.mapPos(block.scope.from, -1), to: removed.mapPos(block.scope.to, 1) };
    const value = sourceBlockInsertion(draft, { from: position, to: position }, source, scope);
    const changes = removed.compose(draft.changes({ from: position, insert: value.insert }));
    if (!preservesSourceBlockScope(state, changes, block)) return null;
    return { changes, selection: EditorSelection.cursor(position + value.offset), scrollIntoView: true };
  };
}

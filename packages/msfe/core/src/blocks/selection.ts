import { EditorSelection, type EditorState } from "@quirekit/cm-state";
import { syntaxTree, syntaxTreeAvailable } from "@quirekit/cm-language";
import type { MsfeCommand } from "../state/types";
import type { SourceBlockInsertionQuery } from "./types";
import { sourceBlockAt } from "./query";
import { sourceBlankLineAt } from "./insertion";
import { sourceBlockInsertion } from "./separators";
import { preservesSourceBlockScope } from "./scope";

/** @param state - Accepted parser snapshot. @returns A legal block replacement range or the structural reason for refusal, without parsing or scanning the document. */
export function querySourceBlockInsertion(state: EditorState): SourceBlockInsertionQuery {
  if (state.readOnly) return { range: null, reason: "readonly" };
  if (state.selection.ranges.length !== 1) return { range: null, reason: "selection" };
  const range = state.selection.main;
  if (!syntaxTreeAvailable(state, range.to)) return { range: null, reason: "unparsed" };
  const blank = sourceBlankLineAt(state, range.from);
  if (blank && range.to <= blank.to) return { range: { from: range.from, to: range.to, scope: blank.scope }, reason: null };
  const block = sourceBlockAt(state, range.from);
  if (!block) return { range: null, reason: "structure" };
  if (range.to > block.to) return { range: null, reason: "selection" };
  if (!range.empty && range.from === block.from && range.to === block.to) return { range: block, reason: null };
  if (block.name !== "Paragraph") {
    const reason = block.name === "Table" ? "table" : ["FencedCode", "CodeBlock"].includes(block.name) ? "code"
      : ["BulletList", "OrderedList"].includes(block.name) ? "list" : block.name === "Blockquote" ? "quote" : "structure";
    return { range: null, reason };
  }
  // Only paragraph text can be split at a caret. A delimiter, link, code span
  // or other inline owner must be selected completely, never cut in half.
  for (const position of [range.from, range.to]) {
    for (let node = syntaxTree(state).resolve(position, 0); node.name !== "Paragraph"; node = node.parent!) {
      if (node.type.isTop) break;
      if (node.from < position && position < node.to) return { range: null, reason: "inline" };
    }
  }
  return { range: { from: range.from, to: range.to, scope: block.scope }, reason: null };
}

/** @param state - Current source and selection. @returns Whether a structured block can replace this selection without splitting an owned structure. */
export function canInsertSourceBlock(state: EditorState): boolean {
  return querySourceBlockInsertion(state).range !== null;
}

/** @param markdown - Complete canonical block source. @returns A guarded atomic insertion at the selected location, without relocating the user's intent. */
export function insertSourceBlockAtSelection(markdown: string): MsfeCommand {
  return state => {
    const { range } = querySourceBlockInsertion(state);
    if (!range || markdown && !markdown.trim()) return null;
    const value = sourceBlockInsertion(state, range, markdown, range.scope);
    const changes = state.changes({ from: range.from, to: range.to, insert: value.insert });
    if (!preservesSourceBlockScope(state, changes, range)) return null;
    return { changes, selection: EditorSelection.range(value.anchor, value.caret), scrollIntoView: true };
  };
}

import { EditorSelection, type EditorState } from "@quirekit/cm-state";
import { syntaxTree, syntaxTreeAvailable } from "@quirekit/cm-language";
import type { MsfeCommand } from "../state/types";
import type { SourceBlankLine } from "./types";
import { sourceBlockScopes } from "./query";
import { preservesSourceBlockScope } from "./scope";
import { sourceBlockInsertion } from "./separators";

/** @param state - Accepted source and syntax. @param position - Pointer or caret position. @returns A blank line in an admitted flow, never whitespace owned by code or list syntax. */
export function sourceBlankLineAt(state: EditorState, position: number): SourceBlankLine | null {
  if (!Number.isInteger(position) || position < 0 || position > state.doc.length) return null;
  const line = state.doc.lineAt(position);
  if (!/^[\t ]*$/u.test(line.text) || !syntaxTreeAvailable(state, line.to)) return null;
  // Neutral bias resolves gaps to their actual owner; at EOF, retain the syntax
  // ending there so an unfinished fence cannot masquerade as a document gap.
  // Do not climb past code, list or other undeclared syntax.
  const owner = syntaxTree(state).resolve(line.from, line.from === state.doc.length ? -1 : 0);
  if (owner.type.isTop) {
    // Some extension grammars exclude the final newline. Let their existing
    // scope veto reject an unfinished owner at that boundary, without parsing.
    if (line.from === state.doc.length && line.from > 0) {
      for (let node = syntaxTree(state).resolve(line.from - 1, -1); !node.type.isTop; node = node.parent!) {
        if (state.facet(sourceBlockScopes).some(resolve => resolve(state, node) === false)) return null;
      }
    }
    return { from: line.from, to: line.to, scope: { from: 0, to: state.doc.length } };
  }
  for (const resolve of state.facet(sourceBlockScopes)) {
    const scope = resolve(state, owner);
    if (scope === false) return null;
    if (scope && Number.isInteger(scope.from) && Number.isInteger(scope.to) && scope.from >= owner.from
      && scope.to <= owner.to && line.from >= scope.from && line.to <= scope.to) return { from: line.from, to: line.to, scope };
  }
  return null;
}

/** @param line - Captured editable blank line. @param markdown - Complete canonical payload; empty keeps the line as an empty paragraph. @returns One guarded replacement preserving sibling separators and enclosing containers. */
export function insertAtSourceBlankLine(line: SourceBlankLine, markdown: string): MsfeCommand {
  return state => {
    const current = sourceBlankLineAt(state, line.from);
    if (!current || current.from !== line.from || current.to !== line.to || current.scope.from !== line.scope.from
      || current.scope.to !== line.scope.to || markdown && !markdown.trim()) return null;
    // An empty payload opens the blank line itself as an empty paragraph.
    if (!markdown) return { selection: EditorSelection.cursor(line.from), scrollIntoView: true };
    const value = sourceBlockInsertion(state, line, markdown, line.scope);
    const changes = state.changes({ from: line.from, to: line.to, insert: value.insert });
    if (!preservesSourceBlockScope(state, changes, line)) return null;
    return { changes, selection: EditorSelection.range(value.anchor, value.caret), scrollIntoView: true };
  };
}

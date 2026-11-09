import type { EditorState } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";

/** @param state - Parsed source. @param pos - Position in a fenced block's source. @returns The enclosing fenced block, or null. */
export function fencedAt(state: EditorState, pos: number): SyntaxNode | null {
  for (const side of [-1, 1] as const) {
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side);
    while (node && node.name !== "FencedCode") node = node.parent;
    if (node) return node;
  }
  return null;
}

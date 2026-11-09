import { EditorSelection, type EditorState, type TransactionSpec } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import { mdCodeLanguages } from "../../code/languages";
import { proseInput } from "../paragraph";

/** Code language names a new block's only line may hold when Enter turns it into the language; rendered diagrams have their own editors. */
const fenceNames = new Set([...mdCodeLanguages.flatMap(entry => [entry.name, ...entry.aliases ?? []]),
  "text", "plain", "markdown", "md"].map(name => name.toLowerCase()));

/**
 * Enter in a fenced block that has no language and only one line: an empty line
 * stays as it is, since typing the fence already opened that line, and a known
 * language name moves into the fence, as `` ```js `` then Enter does in other
 * editors.
 * @param state - Source-owned input draft.
 * @returns The edit or an explicit no-op, or null for native Enter.
 */
export function enterNewFence(state: EditorState): TransactionSpec | null {
  const { main } = state.selection;
  if (!proseInput(state) || state.selection.ranges.length !== 1 || !main.empty) return null;
  let block: SyntaxNode | null = syntaxTree(state).resolveInner(main.head, -1);
  while (block && block.name !== "FencedCode") block = block.parent;
  const [open, close] = block?.getChildren("CodeMark") ?? [];
  if (!block || !open || !close || block.getChild("CodeInfo")) return null;
  const opening = state.doc.lineAt(open.from), body = state.doc.lineAt(main.head);
  if (body.number !== opening.number + 1 || state.doc.lineAt(close.from).number !== body.number + 1 || main.head !== body.to) return null;
  const prefix = state.sliceDoc(opening.from, open.from), text = state.sliceDoc(body.from + Math.min(prefix.length, body.length), body.to);
  if (!/\S/u.test(text)) return {};
  if (!fenceNames.has(text.trim().toLowerCase())) return null;
  const start = body.to - text.length;
  return { changes: [{ from: open.to, insert: text.trim() }, { from: start, to: body.to }],
    selection: EditorSelection.cursor(start + text.trim().length), scrollIntoView: true, userEvent: "input" };
}

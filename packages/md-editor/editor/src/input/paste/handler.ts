import { EditorSelection, Prec, type EditorState } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import { EditorView } from "@quirekit/cm-view";
import { proseInput } from "../paragraph";
import { cellAt } from "../table";
import { hasStructure, htmlToMarkdown } from "./html";

/** @param state - Source. @param position - Paste position. @returns Whether the position is in code, where pasted text stays literal. */
function inCode(state: EditorState, position: number): boolean {
  for (let node: ReturnType<typeof syntaxTree>["topNode"] | null = syntaxTree(state).resolveInner(position, -1); node; node = node.parent) {
    if (/^(?:FencedCode|CodeBlock|InlineCode|Frontmatter|HTMLBlock)$/u.test(node.name)) return true;
  }
  return false;
}

/**
 * Fits pasted text to where it lands: one line in a table cell with literal
 * pipes, and later lines continuing the list item or quote it is pasted into.
 * @param text - Pasted text. @param state - Source before the paste.
 * @returns The text to insert.
 */
export function fitPastedText(text: string, state: EditorState): string {
  if (!proseInput(state) || state.selection.ranges.length !== 1) return text;
  const { from } = state.selection.main;
  if (inCode(state, from)) return text;
  if (cellAt(state, from)) return text.replace(/\s*\r?\n\s*/gu, " ").replace(/(^|[^\\])\|/gu, "$1\\|");
  if (!/\n/u.test(text) && !/^\s*(?:[-*+]|\d+[.)])\s/u.test(text)) return text;
  const line = state.doc.lineAt(from);
  const prefix = /^(\s*(?:>\s?)*)((?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)?/u.exec(line.text)!;
  if (!prefix[0] || line.from + prefix[0].length > from) return text;
  // A pasted list joins the list as sibling items: after this item, or in place of an empty one.
  const items = text.split(/\r?\n/u).filter(part => /\S/u.test(part));
  if (prefix[2] && items.length && items.every(part => /^\s*(?:[-*+]|\d+[.)])\s/u.test(part))) {
    const lines = items.map(part => prefix[1] + part);
    if (!/\S/u.test(line.text.slice(prefix[0].length))) return [items[0]!.replace(/^\s*(?:[-*+]|\d+[.)])\s+/u, ""), ...lines.slice(1)].join("\n");
    if (from === line.to) return `\n${lines.join("\n")}`;
  }
  // Quote markers repeat; a list marker becomes the indentation of its item's text.
  const continuation = prefix[1]! + " ".repeat(prefix[2]?.length ?? 0);
  return text.split(/\r?\n/u).map((part, index) => index === 0 ? part : /\S/u.test(part) ? continuation + part : continuation.trimEnd()).join("\n");
}

/** @param view - Editor. @param markdown - Converted Markdown. @returns Whether the paste was inserted. */
function insertMarkdown(view: EditorView, markdown: string): boolean {
  const state = view.state, { from, to } = state.selection.main, line = state.doc.lineAt(from);
  const block = /\n/u.test(markdown) || /^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|\|)/u.test(markdown);
  let insert = fitPastedText(markdown, state);
  // Block content sits apart from the paragraph text around the caret.
  if (block && insert === markdown) {
    if (/\S/u.test(state.sliceDoc(line.from, from))) insert = `\n\n${insert}`;
    if (/\S/u.test(state.sliceDoc(to, state.doc.lineAt(to).to))) insert = `${insert}\n\n`;
  }
  const end = from + insert.length - (insert.endsWith("\n\n") && insert !== markdown ? 2 : 0);
  view.dispatch({ changes: { from, to, insert }, selection: EditorSelection.cursor(end), scrollIntoView: true, userEvent: "input.paste" });
  return true;
}

/** Pasted text fits its target, a URL over selected text links it, and web or document HTML arrives as Markdown. */
export const pasteInput = [
  EditorView.clipboardInputFilter.of(fitPastedText),
  Prec.high(EditorView.domEventHandlers({ paste(event, view) {
    const data = event.clipboardData, state = view.state, { main } = state.selection;
    // Paste during composition stays native, as CodeMirror leaves it.
    if (!data || view.composing || !proseInput(state) || state.selection.ranges.length !== 1 || inCode(state, main.from)) return false;
    const plain = data.getData("text/plain").trim();
    if (!main.empty && /^https?:\/\/\S+$/u.test(plain) && !/\n/u.test(state.sliceDoc(main.from, main.to)) && !cellAt(state, main.from)) {
      event.preventDefault();
      view.dispatch({ changes: [{ from: main.from, insert: "[" }, { from: main.to, insert: `](${plain})` }],
        selection: EditorSelection.cursor(main.to + plain.length + 4), userEvent: "input.paste" });
      return true;
    }
    const html = data.getData("text/html");
    if (!html || !hasStructure(html) || data.files.length) return false;
    const markdown = htmlToMarkdown(html);
    if (!markdown) return false;
    event.preventDefault();
    return insertMarkdown(view, markdown);
  } })),
];

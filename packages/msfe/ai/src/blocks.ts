import { ensureSyntaxTree, syntaxTree } from "@quirekit/cm-language";
import type { EditorState } from "@quirekit/cm-state";
import type { SyntaxNode } from "@lezer/common";
import type { QuireAiSourceBlock, QuireAiSourceBlockKind } from "@quirekit/ai-runtime/source";

/** Time the parser may take to finish a document before segmenting it, in milliseconds. */
const parseBudget = 2_000;

/** Lezer list node names. */
const listNames = new Set(["BulletList", "OrderedList"]);

/** Neutral kinds of leaf block node names. */
const kinds: Readonly<Record<string, QuireAiSourceBlockKind>> = {
  Paragraph: "paragraph", Blockquote: "quote", FencedCode: "code", CodeBlock: "code", DisplayMath: "math",
  HTMLBlock: "html", CommentBlock: "html", ProcessingInstructionBlock: "html", Table: "table", Frontmatter: "front-matter",
  FootnoteDefinition: "footnote", LinkReference: "definition", AbbreviationDefinition: "definition", HorizontalRule: "thematic-break"
};

/**
 * Segments a Markdown state into the blocks the AI core lists: top-level blocks, and each list
 * item with its nested items beneath it. A list item's own source ends where its nested list begins.
 * @param state - Editor or read state.
 * @returns Blocks, parents before children, in source order.
 */
export function segmentMsfeSource(state: EditorState): QuireAiSourceBlock[] {
  const tree = ensureSyntaxTree(state, state.doc.length, parseBudget) ?? syntaxTree(state);
  const blocks: QuireAiSourceBlock[] = [];
  /** @param from - Start. @param to - End. @returns End without trailing whitespace. */
  const trim = (from: number, to: number) => {
    const text = state.sliceDoc(from, to);
    return from + text.trimEnd().length;
  };
  /** @param item - ListItem node. @param depth - Nesting depth. @param list - Start of its list. @param ordered - Whether the list is numbered. */
  const visitItem = (item: SyntaxNode, depth: number, list: number, ordered: boolean) => {
    const nested: SyntaxNode[] = [];
    for (let child = item.firstChild; child !== null; child = child.nextSibling) if (listNames.has(child.name)) nested.push(child);
    const line = state.doc.lineAt(item.from);
    const indent = state.sliceDoc(line.from, item.from);
    blocks.push({
      from: item.from, to: trim(item.from, nested[0]?.from ?? item.to), end: trim(item.from, item.to), kind: "list-item", name: "ListItem",
      depth, indent: /^\s*$/u.test(indent) ? indent : "", attrs: { ordered }, list
    });
    for (const sub of nested) for (let child = sub.firstChild; child !== null; child = child.nextSibling) {
      if (child.name === "ListItem") visitItem(child, depth + 1, sub.from, sub.name === "OrderedList");
    }
  };
  for (let node = tree.topNode.firstChild; node !== null; node = node.nextSibling) {
    if (listNames.has(node.name)) {
      for (let child = node.firstChild; child !== null; child = child.nextSibling) {
        if (child.name === "ListItem") visitItem(child, 0, node.from, node.name === "OrderedList");
      }
      continue;
    }
    const to = trim(node.from, node.to);
    if (to <= node.from) continue;
    blocks.push({ from: node.from, to, end: to, ...describe(state, node), depth: 0, indent: "" });
  }
  return blocks;
}

/**
 * @param state - State.
 * @param node - Top-level block node.
 * @returns Kind, name and attributes of the block.
 */
function describe(state: EditorState, node: SyntaxNode): Pick<QuireAiSourceBlock, "kind" | "name" | "attrs"> {
  const heading = /^(?:ATXHeading|SetextHeading)(\d)$/u.exec(node.name);
  if (heading !== null) return { kind: "heading", name: node.name, attrs: { level: Number(heading[1]) } };
  const info = node.name === "FencedCode" ? node.getChild("CodeInfo") : null;
  const attrs: Readonly<Record<string, string>> = info === null ? {} : { language: state.sliceDoc(info.from, info.to).trim() };
  return { kind: kinds[node.name] ?? "other", name: node.name, attrs };
}

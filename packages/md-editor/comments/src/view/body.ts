import { defineComponent, h, type VNodeChild } from "vue";
import type { SyntaxNode } from "@lezer/common";
import { parser, Strikethrough } from "@quirekit/lezer-markdown";
import { decodeMarkdownDestination, decodeMarkdownString, isSafeDestination } from "@quirekit/msfe-core";

/** Comment bodies allow inline formatting only; strikethrough is the one GFM addition. */
const inlineParser = parser.configure([Strikethrough]);

/** Inline wrappers rendered as elements; marks inside them are dropped. */
const wrappers: Readonly<Record<string, string>> = { Emphasis: "em", StrongEmphasis: "strong", Strikethrough: "s" };
/** Delimiter nodes that never render. */
const marks = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark", "LinkMark"]);

/**
 * Renders a node's inline content; text between children is kept verbatim.
 * @param source - Comment body.
 * @param node - Parent node.
 * @returns Children.
 */
function children(source: string, node: SyntaxNode): VNodeChild[] {
  const out: VNodeChild[] = [];
  let at = node.from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from > at) out.push(source.slice(at, child.from));
    out.push(...inline(source, child));
    at = child.to;
  }
  if (node.to > at) out.push(source.slice(at, node.to));
  return out;
}

/**
 * @param source - Comment body.
 * @param node - Link node.
 * @returns A safe anchor, a mention for `[@name](url)` links, or the label as text when the destination is unsafe.
 */
function link(source: string, node: SyntaxNode): VNodeChild[] {
  const open = node.firstChild, close = open ? [...siblings(open)].find(item => item.name === "LinkMark" && source[item.from] === "]") : undefined;
  const url = node.getChild("URL");
  if (!open || !close || !url) return [source.slice(node.from, node.to)];
  const label = decodeMarkdownString(source.slice(open.to, close.from));
  let raw = source.slice(url.from, url.to);
  if (raw.startsWith("<") && raw.endsWith(">")) raw = raw.slice(1, -1);
  const href = decodeMarkdownDestination(raw);
  if (!isSafeDestination(href, false)) return [label];
  const mention = label.startsWith("@");
  return [h("a", { href, target: "_blank", rel: "noopener noreferrer", class: mention ? "md-comment-mention" : "md-comment-link" }, label)];
}

/** @param first - Starting node. @returns It and its following siblings. */
function* siblings(first: SyntaxNode): Generator<SyntaxNode> {
  for (let node: SyntaxNode | null = first; node; node = node.nextSibling) yield node;
}

/** @param source - Comment body. @param node - Inline node. @returns Rendered content. */
function inline(source: string, node: SyntaxNode): VNodeChild[] {
  if (marks.has(node.name)) return [];
  const tag = wrappers[node.name];
  if (tag) return [h(tag, children(source, node))];
  if (node.name === "InlineCode") {
    const open = node.firstChild, close = node.lastChild;
    return [h("code", source.slice(open?.to ?? node.from, close && close !== open ? close.from : node.to))];
  }
  if (node.name === "Link") return link(source, node);
  if (node.name === "Escape") return [source.slice(node.from + 1, node.to)];
  if (node.name === "Entity") return [decodeMarkdownString(source.slice(node.from, node.to))];
  if (node.name === "HardBreak") return ["\n"];
  // Images, HTML and anything else outside the inline subset stay as their source text.
  return [source.slice(node.from, node.to)];
}

/**
 * Renders the allowed Markdown subset of a comment: paragraphs with inline formatting, links and mentions.
 * Block constructs such as headings, lists or code blocks are shown as their source text.
 * @param body - Comment body.
 * @returns Rendered nodes; whitespace is preserved by the container.
 */
export function renderCommentBody(body: string): VNodeChild[] {
  const tree = inlineParser.parse(body), out: VNodeChild[] = [];
  let at = 0;
  for (let block = tree.topNode.firstChild; block; block = block.nextSibling) {
    if (block.from > at) out.push(body.slice(at, block.from));
    out.push(...(block.name === "Paragraph" ? children(body, block) : [body.slice(block.from, block.to)]));
    at = block.to;
  }
  if (body.length > at) out.push(body.slice(at));
  return out;
}

/** Comment body renderer for the card's `body` slot. */
export const CommentBody = defineComponent({
  name: "MdCommentBody",
  props: { /** Comment body Markdown. */ body: { type: String, required: true } },
  /** @param props - Body to render. @returns Render function. */
  setup(props) { return () => h("span", renderCommentBody(props.body)); },
});

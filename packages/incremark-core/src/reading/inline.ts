import { renderHtmlInline } from "../html/render";
import type { SyntaxNode } from "@lezer/common";
import { decodeMarkdownString, readSourceDestination, sourceDocument, sourceNode, isSafeDestination } from "@quirekit/msfe-core";
import { markdownMessages } from "./messages";
import type { ReadingContext } from "./types";
import { renderMath, renderFootnoteNumber } from "./extras";
import { queryFootnotes } from "@quirekit/msfe-markdown-extras";

/** @param context - Immutable snapshot. @param node - Inline owner. @param from - Content start. @param to - Content end. @returns Source text interleaved with safe semantic nodes. */
export function inlineChildren<Output>(context: ReadingContext<Output>, node: SyntaxNode, from = node.from, to = node.to): Output[] {
  const result: Output[] = [];
  let offset = from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.to <= offset || child.from >= to) continue;
    if (child.from > offset) result.push(context.adapter.text(decodeMarkdownString(context.state.sliceDoc(offset, child.from))));
    if (child.name === "HTMLTag" && context.options.html) {
      const html = renderHtmlInline(context, node, child, to, (start, end) => context.adapter.fragment(inlineChildren(context, node, start, end)));
      if (html) { result.push(html.output); offset = html.to; continue; }
    }
    if (child.name === "QuoteMark") {
      offset = child.to + Number(context.state.sliceDoc(child.to, child.to + 1) === " "); continue;
    }
    result.push(context.render(child)); offset = child.to;
  }
  if (offset < to) result.push(context.adapter.text(decodeMarkdownString(context.state.sliceDoc(offset, to))));
  return result;
}

/** @param context - Immutable source and locale. @param node - Confirmed inline syntax. @returns Native inline content or undefined for a block/unknown owner. */
export function renderInline<Output>(context: ReadingContext<Output>, node: SyntaxNode): Output | undefined {
  const { state } = context;
  if (/^(?:EmphasisMark|StrikethroughMark|CodeMark|HeaderMark|ListMark|QuoteMark|SubscriptMark|SuperscriptMark|InsertedTextMark|HighlightMark|DefinitionMark)$/u.test(node.name)) return context.adapter.fragment([]);
  // A line break is safe without the HTML opt-in; it is the only break a GFM table cell can hold.
  if (node.name === "HTMLTag" && /^<br\s*\/?>$/iu.test(state.sliceDoc(node.from, node.to))) return context.element(node, "br", {}, context.adapter.fragment([]));
  if (node.name === "InlineMath") return renderMath(context, node);
  if (node.name === "FootnoteReference") return renderFootnoteNumber(context, node);
  if (node.name === "InlineFootnote") return context.element(node, "span", { role: "note" }, context.adapter.fragment([
    context.adapter.text(`[${queryFootnotes(state).inline.get(node.from) ?? ""}: `), ...inlineChildren(context, node, node.from + 2, node.to - 1), context.adapter.text("]"),
  ]));
  const tag = ({ StrongEmphasis: "strong", Emphasis: "em", Strikethrough: "del", InlineCode: "code", Subscript: "sub", Superscript: "sup", InsertedText: "ins", Highlight: "mark" } as Record<string, string>)[node.name];
  if (tag) {
    if (tag === "code") {
      const marks = node.getChildren("CodeMark");
      const content = state.sliceDoc(marks[0]?.to ?? node.from, marks.at(-1)?.from ?? node.to).replace(/\n/gu, " ");
      return context.element(node, "code", {}, context.adapter.text(/^ .* $/u.test(content) && /\S/u.test(content) ? content.slice(1, -1) : content));
    }
    return context.element(node, tag, {}, context.adapter.fragment(inlineChildren(context, node)));
  }
  if (["Link", "Autolink", "URL", "Image"].includes(node.name)) {
    const destination = readSourceDestination(sourceDocument(state), sourceNode(node));
    if (!destination || !isSafeDestination(destination.url, node.name === "Image")) return context.adapter.text(state.sliceDoc(node.from, node.to));
    if (node.name === "Image") return context.element(node, "img", { src: destination.url, title: destination.title,
      alt: decodeMarkdownString(state.sliceDoc(destination.labelFrom, destination.labelTo)) });
    return context.element(node, "a", { href: destination.url, title: destination.title }, context.adapter.fragment(inlineChildren(context, node, destination.labelFrom, destination.labelTo)));
  }
  if (node.name === "TaskMarker") return context.adapter.task(node, /x/iu.test(state.sliceDoc(node.from, node.to)), markdownMessages[context.locale].taskLabel);
  if (node.name === "HardBreak") return context.element(node, "br");
  if (node.name === "Escape" || node.name === "Entity") return context.adapter.text(decodeMarkdownString(state.sliceDoc(node.from, node.to)));
  return undefined;
}

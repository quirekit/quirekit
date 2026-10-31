import type { Node, Schema, Transaction } from "@quirekit/pm";
import { quireAiLineBreak, type QuireAiInlineSpan } from "./markup";
import type { QuireAiEditRange } from "./types";

/**
 * Finds every occurrence of exact text in a text block.
 *
 * Inline non-text leaves count as one object character, so text never matches across them.
 *
 * @param node - Text block.
 * @param pos - Position before the block.
 * @param find - Exact text.
 * @returns Document ranges of each occurrence in order.
 */
export function findQuireAiText(node: Node, pos: number, find: string): readonly QuireAiEditRange[] {
  let text = "";
  const positions: number[] = [];
  node.descendants((child, offset) => {
    if (child.isText) {
      for (let index = 0; index < child.text!.length; index += 1) positions.push(pos + 1 + offset + index);
      text += child.text;
    } else if (child.isLeaf) {
      positions.push(pos + 1 + offset);
      // A line break matches the `<br/>` the view shows; other inline objects match nothing a model writes.
      text += child.type.name === "hardBreak" ? quireAiLineBreak : "￼";
    }
  });
  const ranges: QuireAiEditRange[] = [];
  for (let index = text.indexOf(find); index >= 0; index = text.indexOf(find, index + find.length)) {
    ranges.push({ from: positions[index]!, to: positions[index + find.length - 1]! + 1 });
  }
  return ranges;
}

/**
 * Splits parsed text into lines, clipping spans to each line.
 * @param text - Plain text.
 * @param spans - Spans over the whole text.
 * @returns Lines with spans relative to each line.
 */
export function splitQuireAiLines<Span extends QuireAiInlineSpan>(
  text: string,
  spans: readonly Span[]
): readonly { readonly text: string; readonly spans: readonly Span[] }[] {
  const lines: { text: string; spans: Span[] }[] = [];
  let start = 0;
  for (const line of text.split("\n")) {
    const end = start + line.length;
    lines.push({
      text: line,
      spans: spans.filter(span => span.start < end && span.end > start)
        .map(span => ({ ...span, start: Math.max(span.start, start) - start, end: Math.min(span.end, end) - start }))
    });
    start = end + 1;
  }
  return lines;
}

export { quireAiLineBreak } from "./markup";

/**
 * Replaces a text range with text that holds line breaks, in one step.
 *
 * The new text takes the formatting the range had, as `insertText` would; each line
 * separator becomes a line break node. One replacement keeps a tracked edit one insertion.
 *
 * @param tr - Transaction.
 * @param from - Range start.
 * @param to - Range end.
 * @param text - New text with line separators.
 */
export function replaceQuireAiTextWithLineBreaks(tr: Transaction, from: number, to: number, text: string): void {
  const $from = tr.doc.resolve(from);
  const marks = from === to ? $from.marks() : $from.marksAcross(tr.doc.resolve(to)) ?? [];
  const schema = tr.doc.type.schema;
  const nodes: Node[] = [];
  text.split(quireAiLineBreak).forEach((part, index) => {
    if (index > 0) nodes.push(schema.nodes.hardBreak === undefined ? schema.text(" ", marks) : schema.nodes.hardBreak.create());
    if (part.length > 0) nodes.push(schema.text(part, marks));
  });
  tr.replaceWith(from, to, nodes);
}

/**
 * Builds the inline content of planned text, turning each line separator into a line break.
 *
 * A line break takes one position like the character it replaces, so span
 * offsets computed on the text stay valid.
 *
 * @param schema - Document schema.
 * @param text - Planned text.
 * @returns Inline nodes.
 */
export function createQuireAiInlineContent(schema: Schema, text: string): Node[] {
  const lineBreak = schema.nodes.hardBreak;
  const nodes: Node[] = [];
  text.split(quireAiLineBreak).forEach((part, index) => {
    if (index > 0) nodes.push(lineBreak === undefined ? schema.text(" ") : lineBreak.create());
    if (part.length > 0) nodes.push(schema.text(part));
  });
  return nodes;
}

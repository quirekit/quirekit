import { GFM, parser } from "@quirekit/lezer-markdown";
import type { MarkdownSyntax, SyntaxRange } from "./types";

const markdown = parser.configure(GFM);
const BLOCKS = new Set(["FencedCode", "CodeBlock", "HTMLBlock", "CommentBlock", "ProcessingInstructionBlock"]);
const INLINE = new Set(["InlineCode", "HTMLTag", "Comment", "ProcessingInstruction", "Autolink"]);
const UNITS = new Set(["Emphasis", "StrongEmphasis", "Strikethrough", "Link", "Image"]);

/** @param source - Markdown. @returns Literal and atomic constructs, each list in source order. */
export function scanMarkdown(source: string): MarkdownSyntax {
  const blocks: SyntaxRange[] = [], inline: SyntaxRange[] = [], units: SyntaxRange[] = [];
  markdown.parse(source).iterate({ enter(node) {
    if (BLOCKS.has(node.name)) { blocks.push({ from: node.from, to: node.to }); return false; }
    if (INLINE.has(node.name)) { inline.push({ from: node.from, to: node.to }); return false; }
    if (UNITS.has(node.name)) units.push({ from: node.from, to: node.to });
    return undefined;
  } });
  return { blocks, inline, units };
}

/**
 * @param ranges - Non-overlapping ranges in source order.
 * @param position - Offset.
 * @returns The range strictly containing the offset, if any.
 */
export function containing(ranges: readonly SyntaxRange[], position: number): SyntaxRange | undefined {
  let low = 0, high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1, range = ranges[middle]!;
    if (range.to <= position) low = middle + 1;
    else if (range.from >= position) high = middle - 1;
    else return range;
  }
  return undefined;
}

/** @param ranges - Ranges in source order. @param from - Start. @param to - End. @returns Whether any range overlaps `[from, to)`. */
export function overlaps(ranges: readonly SyntaxRange[], from: number, to: number): boolean {
  return ranges.some(range => range.from < to && from < range.to);
}

/**
 * Grows a range until no inline construct has exactly one of its edges inside, so marks never split syntax.
 * @param units - Inline constructs.
 * @param range - Requested range.
 * @returns Range covering every construct it cuts.
 */
export function wrapUnits(units: readonly SyntaxRange[], range: SyntaxRange): SyntaxRange {
  let { from, to } = range, changed = true;
  while (changed) {
    changed = false;
    for (const unit of units) {
      const cutsStart = unit.from < from && from < unit.to && to > unit.to, cutsEnd = unit.from < to && to < unit.to && from < unit.from;
      if (cutsStart) { from = unit.from; changed = true; }
      if (cutsEnd) { to = unit.to; changed = true; }
    }
  }
  return { from, to };
}

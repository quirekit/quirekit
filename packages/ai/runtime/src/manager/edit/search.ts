import type { Node } from "@quirekit/pm";
import type { QuireAiRegistry } from "../types";
import { collectQuireAiBlocks, collectQuireAiSections } from "../view/collect";
import { findQuireAiText, quireAiLineBreak } from "./text";
import type { QuireAiEditRange, QuireAiTextMatches } from "./types";

/**
 * Turns text as the model writes it into the text blocks are matched against.
 * @param text - Text from the model, possibly with `<br/>` and copied field brackets.
 * @returns Text with line separators and without field brackets.
 */
export function normalizeQuireAiSearchText(text: string): string {
  return text.replace(/[⟦⟧]/gu, "").replaceAll("<br/>", quireAiLineBreak);
}

/**
 * Finds exact text in every text block the view lists: body, table cells, headers, footers,
 * notes and other stories.
 *
 * Matching is replace_text's, so every occurrence found can be replaced.
 *
 * @param doc - Current document.
 * @param registry - Compiled facts.
 * @param find - Normalized text to find.
 * @param within - Document ranges a block must start in; every block when omitted.
 * @returns Blocks with at least one occurrence, in view order.
 */
export function searchQuireAiText(doc: Node, registry: QuireAiRegistry, find: string, within?: readonly QuireAiEditRange[]): QuireAiTextMatches[] {
  const found: QuireAiTextMatches[] = [];
  for (const section of collectQuireAiSections(doc, registry)) {
    for (const block of collectQuireAiBlocks(section, registry)) {
      if (!block.node.isTextblock) continue;
      if (within !== undefined && !within.some(range => block.pos >= range.from && block.pos < range.to)) continue;
      const ranges = findQuireAiText(block.node, block.pos, find);
      if (ranges.length > 0) found.push({ block, ranges });
    }
  }
  return found;
}

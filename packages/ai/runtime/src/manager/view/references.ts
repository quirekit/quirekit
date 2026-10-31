import type { Node } from "@quirekit/pm";
import type { QuireAiBlockIdentity, QuireAiRegistry } from "../types";
import { collectQuireAiBlocks, collectQuireAiSections } from "./collect";

/** Language a reply is written in, which decides the wording of block references. */
export type QuireAiReplyLanguage = "zh" | "en";

/** Characters of block text quoted to name a block outside the body's numbered paragraphs. */
const previewLength = 12;

/** A block id, optionally in brackets as the view writes it. */
const idPattern = "\\[?\\bb(\\d+)\\b\\]?";

/** A range of two block ids, such as "b3-b5" or "b3 到 b5". */
const rangePattern = new RegExp(`${idPattern}\\s*(?:-|–|—|~|～|到|至)\\s*${idPattern}`, "gu");

/** One block id. */
const singlePattern = new RegExp(idPattern, "gu");

/** How the reply names one block. */
interface BlockName {
  /** Paragraph number in the body, counted over its top-level blocks, or null outside them. */
  readonly ordinal: number | null;
  /** Wording without the number, such as a quote of the block's start. */
  readonly text: string;
}

/**
 * Rewrites block ids in a reply into words people understand.
 *
 * The view and the editing tool address blocks by ids such as `b3`, so a model tends to
 * use them when it talks about blocks, whatever its instructions say. Ids are internal,
 * so the reply shown to people names blocks instead: a top-level body block by its
 * paragraph number, any other block by a quote of its start, and a deleted block as
 * "that paragraph". Only ids the identity table issued are rewritten, so ordinary text
 * such as "b12" in a product name stays as written.
 *
 * @param text - Reply text.
 * @param doc - Current document.
 * @param registry - Compiled facts.
 * @param identity - Identity table that issued the ids.
 * @param language - Language of the reply.
 * @returns Reply with every issued block id replaced.
 */
export function describeQuireAiBlockReferences(
  text: string,
  doc: Node,
  registry: QuireAiRegistry,
  identity: QuireAiBlockIdentity,
  language: QuireAiReplyLanguage
): string {
  if (!/\bb\d/u.test(text)) return text;
  const names = new Map<string, BlockName | null>();
  let ordinals: ReadonlyMap<number, BlockName> | null = null;
  /** @param id - Block id. @returns How to name it, null for a deleted block, undefined for text that is not an issued id. */
  const name = (id: string): BlockName | null | undefined => {
    if (!identity.issued(id)) return undefined;
    if (!names.has(id)) {
      const pos = identity.resolve(id);
      ordinals ??= nameBlocks(doc, registry, language);
      names.set(id, pos === null ? null : ordinals.get(pos) ?? null);
    }
    return names.get(id);
  };
  const deleted = language === "zh" ? "该段" : "that paragraph";
  /** @param block - Named block or null. @returns Full wording. */
  const describe = (block: BlockName | null) => block === null ? deleted
    : block.ordinal === null ? block.text
      : language === "zh" ? `第 ${block.ordinal} 段` : `paragraph ${block.ordinal}`;
  return text
    .replace(rangePattern, (match, first: string, last: string) => {
      const from = name(`b${first}`);
      const to = name(`b${last}`);
      if (from === undefined || to === undefined) return match;
      if (from?.ordinal != null && to?.ordinal != null) {
        return language === "zh" ? `第 ${from.ordinal} 至 ${to.ordinal} 段` : `paragraphs ${from.ordinal}–${to.ordinal}`;
      }
      return `${describe(from)}${language === "zh" ? "至" : " to "}${describe(to)}`;
    })
    .replace(singlePattern, (match, number: string) => {
      const block = name(`b${number}`);
      return block === undefined ? match : describe(block);
    });
}

/**
 * Names every listed block: top-level body blocks get paragraph numbers in document order,
 * nested and story blocks a quote of their text or their section title.
 * @param doc - Current document.
 * @param registry - Compiled facts.
 * @param language - Language of the reply.
 * @returns Name of each block by position.
 */
function nameBlocks(doc: Node, registry: QuireAiRegistry, language: QuireAiReplyLanguage): ReadonlyMap<number, BlockName> {
  const named = new Map<number, BlockName>();
  let ordinal = 0;
  for (const section of collectQuireAiSections(doc, registry)) {
    for (const block of collectQuireAiBlocks(section, registry)) {
      if (!section.story && block.depth === 0) {
        named.set(block.pos, { ordinal: ordinal += 1, text: "" });
        continue;
      }
      const content = block.node.textContent.trim();
      const quote = content.length > previewLength ? `${content.slice(0, previewLength)}…` : content;
      const where = section.title.replace(/（.*）$/u, "");
      named.set(block.pos, {
        ordinal: null,
        text: quote.length > 0 ? `“${quote}”` : language === "zh" ? `${where}中的空段落` : `an empty paragraph in ${where}`
      });
    }
  }
  return named;
}

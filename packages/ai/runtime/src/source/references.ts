import type { QuireAiSourceIdentity } from "./view/identity";
import type { QuireAiSourceSnapshot } from "./view/types";

/** Characters quoted to name a block or comment. */
const quoteLength = 12;

/**
 * Rewrites block and comment ids in a reply into words people understand: a top-level block by
 * its paragraph number, a nested block by a quote of its start, a removed block as "that
 * paragraph", and a comment by a quote of its text. Text that only looks like an id stays.
 * @param text - Reply text.
 * @param snapshot - Current snapshot.
 * @param identity - Block identity table.
 * @param language - Language of the reply.
 * @returns Reply without internal ids.
 */
export function describeQuireAiSourceReferences(text: string, snapshot: QuireAiSourceSnapshot, identity: QuireAiSourceIdentity, language: "zh" | "en"): string {
  if (!/\b[bc]\d/u.test(text)) return text;
  const topLevel = snapshot.blocks.filter(block => block.depth === 0);
  const quote = (value: string) => {
    const single = value.replace(/\s+/gu, " ").trim();
    const clipped = single.length > quoteLength ? `${single.slice(0, quoteLength)}…` : single;
    return language === "zh" ? `“${clipped}”` : `"${clipped}"`;
  };
  return text.replace(/\[?\b([bc])(\d+)\b\]?/gu, (match, prefix: string, digits: string) => {
    const id = `${prefix}${digits}`;
    if (prefix === "c") {
      const annotation = snapshot.annotations.find(item => item.id === id);
      if (annotation === undefined) return match;
      return language === "zh" ? `批注${quote(annotation.annotation.quote)}` : `the comment on ${quote(annotation.annotation.quote)}`;
    }
    if (!identity.issued(id)) return match;
    const block = snapshot.blocks.find(item => item.id === id);
    if (block === undefined) return language === "zh" ? "该段" : "that paragraph";
    const ordinal = topLevel.indexOf(block);
    if (ordinal >= 0) return language === "zh" ? `第 ${ordinal + 1} 段` : `paragraph ${ordinal + 1}`;
    return quote(block.summary?.label ?? block.text);
  });
}

import { quireBlockToneColor, type QuireBlockTone } from "@quirekit/ui/vue";

/** Insertion values and block names by family. */
const families: readonly [QuireBlockTone, RegExp][] = [
  ["blue", /^(?:insert-(?:paragraph|h[1-6]|quote|definition)|Paragraph|ATXHeading[1-6]|SetextHeading[12]|Blockquote|link|mention|footnote|inlineMath|displayMath|DisplayMath)$/u],
  ["indigo", /^(?:insert-(?:list|ordered|task)|BulletList|OrderedList|task)$/u],
  ["green", /^(?:insert-code|FencedCode|CodeBlock|Frontmatter)$/u],
  ["orange", /^(?:insert-(?:note|warning|details|highlight|nested|divider)|CustomContainer|HorizontalRule|image|date|emoji)$/u],
  ["teal", /^(?:insert-table|Table|dataView)$/u],
  ["purple", /^(?:textDiagram|mermaid|flowchart|mindMap|whiteboard)$/u],
];

/** @param key - Insertion value or block name. @returns Its family's tone; unknown entries stay neutral. */
export function blockTone(key: string): QuireBlockTone {
  return families.find(([, pattern]) => pattern.test(key))?.[0] ?? "neutral";
}

/** @param key - Insertion value or block name. @returns Inline color for its icon, usable inside overlays outside the editor root. */
export function blockToneStyle(key: string): { color: string } {
  return { color: quireBlockToneColor(blockTone(key)) };
}

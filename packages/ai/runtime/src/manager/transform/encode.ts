import type { Node } from "@quirekit/pm";
import { listQuireAiEditableFormats } from "../edit/schema";
import type { QuireAiRegistry } from "../types";
import { formatQuireAiProperties, readQuireAiFormats } from "../view/inline";
import type { QuireAiSegment } from "./types";

/** One stretch of the block's inline content before tagging. */
interface Run {
  /** Run text, or an object or line-break token. */
  text: string;
  /** Character formats of a text run; null for tokens. */
  readonly values: Map<string, unknown> | null;
  /** Comparable form of the formats. */
  readonly key: string;
}

/**
 * Encodes a text block as a numbered segment.
 *
 * Character formats every text run shares stay out of the text: the program
 * restores them, so the model only sees tags around words formatted unlike the
 * rest. Each tag stands for its run's complete formats. Objects become `<xN/>`,
 * line breaks `<br/>`; zero-width anchors such as bookmarks are left out, and
 * inline containers contribute their text.
 *
 * @param node - Text block.
 * @param block - Block identity.
 * @param number - Segment number.
 * @param registry - Compiled facts.
 * @param doc - Document root, for paragraph formats resolved through document registries.
 * @returns Segment.
 */
export function encodeQuireAiSegment(node: Node, block: string, number: number, registry: QuireAiRegistry, doc: Node): QuireAiSegment {
  // Only formats the edit tool can write back are carried; read-only ones such as revisions stay out.
  const formats = listQuireAiEditableFormats(registry).filter(format => format.level === "character");
  const runs: Run[] = [];
  let objects = 0;
  const visit = (parent: Node): void => parent.forEach(child => {
    if (child.isText) {
      const values = readQuireAiFormats(formats, format => format.read({ level: "character", marks: child.marks }));
      const key = formatQuireAiProperties(values);
      const last = runs.at(-1);
      if (last !== undefined && last.values !== null && last.key === key) last.text += child.text ?? "";
      else runs.push({ text: child.text ?? "", values, key });
    } else if (!child.isLeaf) {
      visit(child);
    } else if (child.type.name === "hardBreak") {
      runs.push({ text: "<br/>", values: null, key: "" });
    } else if (registry.blocks.get(child.type.name)?.label?.(child, doc) !== "") {
      objects += 1;
      runs.push({ text: `<x${objects}/>`, values: null, key: "" });
    }
  });
  visit(node);

  const shared = sharedFormats(runs);
  const sharedKey = formatQuireAiProperties(shared);
  const tags = new Map<number, Readonly<Record<string, unknown>>>();
  const text = runs.map(run => {
    if (run.values === null || run.key === sharedKey) return run.text;
    const tag = tags.size + 1;
    tags.set(tag, Object.fromEntries(run.values));
    return `<t${tag}>${run.text}</t${tag}>`;
  }).join("");
  const numbered = registry.paragraphFormats.some(format => format.numbered === true
    && format.read({ level: "paragraph", node, doc }) !== undefined);
  return { number, block, text, shared: Object.fromEntries(shared), tags, objects, numbered };
}

/**
 * @param runs - Block runs.
 * @returns Formats with the same value in every text run.
 */
function sharedFormats(runs: readonly Run[]): Map<string, unknown> {
  let shared: Map<string, unknown> | undefined;
  for (const run of runs) {
    if (run.values === null || run.text === "") continue;
    const values = run.values;
    const previous: Map<string, unknown> = shared ?? values;
    shared = new Map([...previous].filter(([name, value]) => JSON.stringify(values.get(name)) === JSON.stringify(value)));
  }
  return shared ?? new Map();
}

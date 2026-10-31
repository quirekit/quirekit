import type { Node } from "@quirekit/pm";
import type { QuireAiFormatCapability } from "@quirekit/ai-contract";
import { readQuireAiFormats } from "../view/inline";

/**
 * Reads the formats a new block takes from a reference block.
 *
 * These are the reference's paragraph formats and the character formats its
 * whole text shares, so a translation or rewrite inserted next to a paragraph
 * looks like it without the model restating each value. Only formats the edit
 * tool can apply are read, so the result is a valid `format` set.
 *
 * @param node - Reference text block.
 * @param doc - Document root, for formats resolved through document registries.
 * @param formats - Editable formats.
 * @returns Format values by name.
 */
export function readQuireAiLikeFormats(node: Node, doc: Node, formats: readonly QuireAiFormatCapability[]): Record<string, unknown> {
  const paragraph = readQuireAiFormats(formats.filter(format => format.level === "paragraph"),
    format => format.read({ level: "paragraph", node, doc }));
  const character = formats.filter(format => format.level === "character");
  let shared: Map<string, unknown> | null = null;
  node.descendants(child => {
    if (!child.isText || child.text === "") return true;
    const values = readQuireAiFormats(character, format => format.read({ level: "character", marks: child.marks }));
    shared = shared === null ? values : new Map([...shared].filter(([name, value]) => sameValue(values.get(name), value)));
    return false;
  });
  return Object.fromEntries([...paragraph, ...(shared ?? [])]);
}

/**
 * @param left - First value.
 * @param right - Second value.
 * @returns Whether both are the same JSON value.
 */
function sameValue(left: unknown, right: unknown): boolean {
  return left !== undefined && JSON.stringify(left) === JSON.stringify(right);
}

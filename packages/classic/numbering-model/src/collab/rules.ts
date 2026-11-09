import type { CollabRule } from "@quirekit/collab-contract";
import { resolveWordParagraphNumbering } from "../model";
import type { Node } from "@quirekit/pm";

/**
 * Collaboration rules of numbering: numbered paragraphs refer to list
 * instances that exist in the numbering registry.
 *
 * @returns Rules for `addCollabRules()`.
 */
export function createWordNumberingCollabRules(): readonly CollabRule[] {
  return [
    { kind: "version", version: "2" },
    { kind: "root", attribute: "wordNumberingRegistry", strategy: "merge" },
    { kind: "diagnostics", reasons: ["numbering"], collect: missingLists, scope: { attrs: ["wordNumbering"], root: ["wordNumberingRegistry"] } }
  ];
}

/** @param doc - Document. @returns One key per paragraph numbered with a missing list instance. */
function missingLists(doc: Node): string[] {
  const registry = doc.attrs.wordNumberingRegistry as { nums?: Record<string, unknown> } | null | undefined;
  const problems: string[] = [];
  doc.descendants((node) => {
    const numbering = node.isTextblock ? resolveWordParagraphNumbering((node.attrs as { wordNumbering?: unknown }).wordNumbering) : null;
    if (numbering !== null && registry?.nums?.[numbering.numId] === undefined) problems.push(`numbering:${numbering.numId}`);
    return !node.isTextblock;
  });
  return problems;
}

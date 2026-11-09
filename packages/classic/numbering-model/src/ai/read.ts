import type { Node } from "@quirekit/pm";
import { resolveWordNumberingRegistry } from "../model/registry";
import { resolveWordNumberingLevel } from "../resolver/markers";
import { resolveWordListAiStarts } from "./starts";
import { readWordListAiStyle } from "./styles";
import type { ListValue } from "./types";

/**
 * Reads the list membership of one paragraph.
 * @param node - Paragraph node.
 * @param doc - Document root holding the numbering registry.
 * @param pos - Position before the paragraph, when known; the shown number needs it.
 * @returns List membership, or undefined outside a list.
 */
export function readWordListAiValue(node: Node, doc: Node, pos?: number): ListValue | undefined {
  const numbering = node.attrs.wordNumbering as { numId?: unknown; level?: unknown; task?: { checked?: unknown } | null } | null | undefined;
  if (typeof numbering?.numId !== "string" || numbering.numId === "0") return undefined;
  const level = typeof numbering.level === "number" ? numbering.level : 0;
  const resolved = resolveWordNumberingLevel(resolveWordNumberingRegistry(doc.attrs.wordNumberingRegistry), numbering.numId, level);
  const style = resolved === undefined ? undefined : readWordListAiStyle(resolved.level);
  if (numbering.task != null) return { kind: "task", level, checked: numbering.task.checked === true };
  const start = pos === undefined ? undefined : resolveWordListAiStarts(doc).get(pos);
  return {
    kind: resolved?.level.format === "bullet" ? "bullet" : "number", level,
    ...(style === undefined ? {} : { style }),
    ...(start === undefined ? {} : { start })
  };
}

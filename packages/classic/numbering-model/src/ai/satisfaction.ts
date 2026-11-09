import type { QuireAiFormatSatisfactionContext } from "@quirekit/ai-contract";
import { readWordListAiValue } from "./read";
import { readWordListAiCounter, resolveWordListAiStarts } from "./starts";
import type { ListValue } from "./types";

/**
 * Matches ordinary list fields on every item and a requested run start on its first item.
 * @param context - Immutable current document and mapped selected range.
 * @param value - Requested list fields, or null to clear the selected range.
 * @returns Whether the entire owner-defined range request is already satisfied.
 */
export function isWordListAiRangeSatisfied(context: QuireAiFormatSatisfactionContext, value: unknown): boolean {
  if (value !== null && (typeof value !== "object" || Array.isArray(value))) return false;
  const requested = value as Partial<ListValue> | null;
  const fields = requested === null ? [] : Object.entries(requested).filter(([key]) => key !== "start");
  let first: number | undefined;
  let matches = true;
  context.doc.nodesBetween(context.from, context.to, (node, pos) => {
    if (!matches) return false;
    if (!node.isTextblock) return true;
    first ??= pos;
    const current = readWordListAiValue(node, context.doc, pos);
    matches = requested === null ? current === undefined
      : current !== undefined && fields.every(([key, field]) =>
        JSON.stringify((current as unknown as Record<string, unknown>)[key]) === JSON.stringify(field));
    return false;
  });
  if (!matches || first === undefined) return false;
  if (requested?.checked !== undefined && requested.kind !== "task") return false;
  if (requested?.start === undefined || requested.kind !== "number") return true;
  return readWordListAiCounter(context.doc, first) === requested.start && resolveWordListAiStarts(context.doc).has(first);
}

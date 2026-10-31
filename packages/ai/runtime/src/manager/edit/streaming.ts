import type { Static } from "typebox";
import { Check } from "typebox/value";
import type { QuireAiEditOperationSchema } from "./schema";

type EditOperation = Static<QuireAiEditOperationSchema>;

/** Fields whose partial value may be shown while it streams, per operation. */
const streamingFields: Readonly<Record<string, string>> = {
  replace: "text",
  replace_text: "replace",
  insert: "blocks"
};

/** Operations readable from partially generated `document_edit` arguments. */
export interface QuireAiStreamingOperations {
  /** Operations whose JSON is closed, because a later operation has started. */
  readonly complete: readonly EditOperation[];
  /** Last operation, when its partial value is safe to show; otherwise undefined. */
  readonly trailing?: EditOperation | undefined;
}

/**
 * Reads the operations of partially parsed tool arguments.
 *
 * A partial parser truncates the value being generated. Truncated block ids or
 * search text would target the wrong place, so the last operation is shown only
 * while its text-bearing field is the one streaming; any other trailing
 * operation waits until it is complete. A closed operation that does not fit its
 * kind is left out, as the edit will report it alone.
 *
 * @param input - Partially parsed arguments.
 * @param operation - Strict operation union.
 * @returns Readable operations.
 */
export function readQuireAiStreamingOperations(
  input: unknown,
  operation: QuireAiEditOperationSchema
): QuireAiStreamingOperations {
  const operations = (input as { operations?: unknown } | null)?.operations;
  if (!Array.isArray(operations) || operations.length === 0) return { complete: [] };
  const complete = operations.slice(0, -1).filter(entry => Check(operation, entry));
  const last = trimTrailing(operations.at(-1));
  return {
    complete: complete as EditOperation[],
    ...(last !== undefined && Check(operation, last) ? { trailing: last as EditOperation } : {})
  };
}

/**
 * Keeps the last operation only while its streaming field is the last key.
 * @param operation - Partial last operation.
 * @returns Operation safe to show, or undefined.
 */
function trimTrailing(operation: unknown): unknown {
  if (operation === null || typeof operation !== "object") return undefined;
  const record = operation as Record<string, unknown>;
  const field = typeof record.op === "string" ? streamingFields[record.op] : undefined;
  if (field === undefined || Object.keys(record).at(-1) !== field) return undefined;
  if (field === "replace") return record;
  if (field === "text") return typeof record.text === "string" ? { ...record, text: trimOpenMarkup(record.text) } : record;
  if (!Array.isArray(record.blocks)) return record;
  const blocks = record.blocks.slice(0, -1);
  const lastBlock: unknown = record.blocks.at(-1);
  if (typeof lastBlock === "string") blocks.push(trimOpenMarkup(lastBlock));
  // A trailing structured block may still be missing fields; only streaming text is shown.
  else if (lastBlock !== null && typeof lastBlock === "object" && Object.keys(lastBlock).at(-1) === "text") {
    const entry = lastBlock as { text?: unknown };
    blocks.push(typeof entry.text === "string" ? { ...entry, text: trimOpenMarkup(entry.text) } : entry);
  }
  return { ...record, blocks };
}

/**
 * Cuts a streaming tail that opens inline markup not yet closed, so delimiters
 * never flash as literal text before their closing half arrives.
 * @param source - Partial markup text.
 * @returns Text up to the last unclosed delimiter.
 */
function trimOpenMarkup(source: string): string {
  let text = source.replace(/\\$/u, "");
  const bracket = text.lastIndexOf("[");
  if (bracket >= 0 && !/^\[[^\]]*\]\{[^}]*\}/u.test(text.slice(bracket))) text = text.slice(0, bracket);
  const strong = text.split("**").length - 1;
  if (strong % 2 === 1) text = text.slice(0, text.lastIndexOf("**"));
  const single = text.replace(/\*\*/gu, "").split("*").length - 1;
  if (single % 2 === 1) text = text.slice(0, text.replace(/\*\*/gu, "\u0000\u0000").lastIndexOf("*"));
  return text;
}

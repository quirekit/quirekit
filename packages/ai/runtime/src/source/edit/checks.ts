import type { QuireAiSourceBlockCheck, QuireAiSourceBlockInput } from "@quirekit/ai-contract";
import type { QuireAiSourceDocument } from "../types";
import type { QuireAiSourceSnapshot } from "../view/types";
import { normalizeQuireAiMarkdown } from "./text";

/**
 * @param document - Source document port.
 * @returns Checks of the installed facts, by fence language.
 */
export function readQuireAiSourceChecks(document: QuireAiSourceDocument): ReadonlyMap<string, QuireAiSourceBlockCheck> {
  const checks = new Map<string, QuireAiSourceBlockCheck>();
  for (const fact of document.capabilities()) {
    if (fact.kind !== "source-block" || fact.check === undefined) continue;
    for (const language of fact.check.languages) if (!checks.has(language)) checks.set(language, fact.check);
  }
  return checks;
}

/**
 * Lists the fenced blocks an operation writes that a check covers: the blocks of new or replacing
 * text, and a block whose text a block-level edit changes.
 * @param operation - Operation from the model.
 * @param snapshot - Snapshot the model read.
 * @param document - Source document port, to segment written text.
 * @param checks - Checks by fence language.
 * @returns Blocks to check with their check.
 */
export function collectQuireAiSourceCheckTargets(operation: unknown, snapshot: QuireAiSourceSnapshot, document: QuireAiSourceDocument,
  checks: ReadonlyMap<string, QuireAiSourceBlockCheck>): { readonly block: QuireAiSourceBlockInput; readonly check: QuireAiSourceBlockCheck }[] {
  if (checks.size === 0 || typeof operation !== "object" || operation === null) return [];
  const op = operation as Readonly<Record<string, unknown>>;
  const texts: string[] = [];
  const target = typeof op.block === "string" ? snapshot.blocks.find(item => item.id === op.block) : undefined;
  if (op.op === "replace" && typeof op.text === "string") texts.push(op.text);
  else if (op.op === "insert" && Array.isArray(op.blocks)) texts.push(...op.blocks.filter((item): item is string => typeof item === "string"));
  else if (op.op === "append" && target !== undefined && typeof op.text === "string") texts.push(target.text + op.text);
  else if (op.op === "replace_text" && target !== undefined && typeof op.find === "string" && typeof op.replace === "string") texts.push(target.text.replace(op.find, () => String(op.replace)));
  const found: { block: QuireAiSourceBlockInput; check: QuireAiSourceBlockCheck }[] = [];
  for (const text of texts) {
    const source = normalizeQuireAiMarkdown(text);
    for (const block of document.segment(source)) {
      const language = block.attrs.language;
      const check = typeof language === "string" ? checks.get(language) : undefined;
      if (check !== undefined) found.push({ block: { text: source.slice(block.from, block.to), name: block.name, attrs: block.attrs }, check });
    }
  }
  return found;
}

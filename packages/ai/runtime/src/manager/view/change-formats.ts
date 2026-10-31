import type { QuireAiFormatCapability } from "@quirekit/ai-contract";
import type { QuireDocumentFormatChange } from "../../document-sdk/types";
import type { QuireAiDiffStep } from "./sequence";
import type { QuireAiChangeBlock } from "./types";

/**
 * Compares the format values of one target.
 * @param formats - Declared formats of the level.
 * @param before - Values before.
 * @param after - Values after.
 * @param text - Text the values apply to, for character formats.
 * @returns Changes in declaration order.
 */
export function compareValues(
  formats: readonly QuireAiFormatCapability[],
  before: ReadonlyMap<string, unknown>,
  after: ReadonlyMap<string, unknown>,
  text?: string
): QuireDocumentFormatChange[] {
  return formats.flatMap(format => {
    const old = before.get(format.name);
    const next = after.get(format.name);
    if (JSON.stringify(old ?? null) === JSON.stringify(next ?? null)) return [];
    return [{
      label: format.present?.label ?? format.name,
      before: old === undefined ? null : present(format, old),
      after: next === undefined ? null : present(format, next),
      toggle: (old === undefined || old === true) && (next === undefined || next === true),
      ...(text === undefined ? {} : { text })
    }];
  });
}

/**
 * Compares character formats on the characters both sides keep, grouping equal changes.
 * @param formats - Declared character formats.
 * @param a - Source block.
 * @param b - Candidate block.
 * @param steps - Character edit script.
 * @returns One change per distinct format change, with the text it covers.
 */
export function compareCharacters(formats: readonly QuireAiFormatCapability[], a: QuireAiChangeBlock, b: QuireAiChangeBlock, steps: readonly QuireAiDiffStep[]): QuireDocumentFormatChange[] {
  const grouped = new Map<string, { change: QuireDocumentFormatChange; runs: string[]; last: number }>();
  steps.forEach((step, index) => {
    if (step.kind !== "same") return;
    for (const change of compareValues(formats, a.charFormats[step.a]!, b.charFormats[step.b]!)) {
      const key = JSON.stringify(change);
      const group = grouped.get(key) ?? { change, runs: [], last: -2 };
      // Characters next to each other in the script extend the current run.
      if (group.last === index - 1 && group.runs.length > 0) group.runs[group.runs.length - 1] += a.chars[step.a]!;
      else group.runs.push(a.chars[step.a]!);
      group.last = index;
      grouped.set(key, group);
    }
  });
  return [...grouped.values()].map(({ change, runs }) => ({ ...change, text: runs.join("、") }));
}

/**
 * Writes one format value for people.
 * @param format - Format fact.
 * @param value - Value as read.
 * @returns Display text.
 */
function present(format: QuireAiFormatCapability, value: unknown): string {
  if (format.present?.value !== undefined) return format.present.value(value);
  return typeof value === "string" ? value : JSON.stringify(value);
}

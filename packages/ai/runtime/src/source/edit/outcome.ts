import { quireAiSourceEditOperationLimit } from "./schema";
import type { QuireAiSourceEditFailure, QuireAiSourcePlannedOperation } from "./plan";

/** Failures reported back in full; longer lists are counted. */
const reportedFailureLimit = 20;

/**
 * Writes the model-visible outcome: how many applied, and what to send again.
 * @param total - Operations the model sent.
 * @param applied - Operations that applied.
 * @param failures - Operations that failed.
 * @param unprocessed - Operations past the per-call limit.
 * @returns Result text.
 */
export function describeQuireAiSourceOutcome(total: number, applied: readonly QuireAiSourcePlannedOperation[],
  failures: readonly QuireAiSourceEditFailure[], unprocessed: number): string {
  const counts = applied.filter(entry => entry.occurrences > 1).map(entry => `\nOperation ${entry.source + 1} replaced ${entry.occurrences} occurrences.`).join("");
  if (failures.length === 0 && unprocessed === 0) return `Applied ${applied.length} operation(s).${counts}`;
  const lines = [applied.length === 0 ? "No operation could be applied; nothing was changed." : `Applied ${applied.length} of ${total} operations.${counts}`];
  if (failures.length > 0) {
    lines.push("Failed — send only these again, with corrected values:");
    for (const failure of [...failures].sort((left, right) => left.source - right.source).slice(0, reportedFailureLimit)) lines.push(`- ${failure.message}`);
    if (failures.length > reportedFailureLimit) lines.push(`- …and ${failures.length - reportedFailureLimit} more failed operations.`);
  }
  if (unprocessed > 0) {
    lines.push(`Operations ${quireAiSourceEditOperationLimit + 1}–${total} were not processed: one call takes at most ${quireAiSourceEditOperationLimit}; send them in another call.`);
  }
  return lines.join("\n");
}

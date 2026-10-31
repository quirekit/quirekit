import type { ChainedCommands } from "@quirekit/core";
import type { QuireAiEditReport } from "./execute";
import { operationName } from "./operation-check";
import { quireAiEditOperationLimit } from "./schema";
import type { QuireAiEditFailure, QuireAiEditPlan, QuireAiPlannedOperation } from "./types";

/** Failures reported back in full; longer lists are counted. */
const reportedFailureLimit = 20;

/** What an edit came to, for the model-visible result. */
export interface QuireAiEditOutcome {
  /** Operations the model sent. */
  readonly total: number;
  /** Operations that will apply. */
  readonly plan: readonly QuireAiPlannedOperation[];
  /** Operations that failed, in list order. */
  readonly failures: readonly QuireAiEditFailure[];
  /** Operations past the per-call limit. */
  readonly unprocessed: number;
  /** Whether a tracked edit was written directly because revisions cannot record it. */
  readonly untracked?: boolean | undefined;
}

/**
 * Drops operations whose commands are refused, so the rest of the edit can apply.
 *
 * The plan is dry-run as one chain; when an operation's commands fail, that
 * operation (every planned step from it) is reported and removed and the rest
 * run again. Failures are rare, so this costs about one run per failure plus
 * one.
 *
 * @param planning - Operation-by-operation plan.
 * @param operations - Operations from the model, for naming failures.
 * @param dryRun - Builds a non-committing chain for a plan, recording the first failed step in the report.
 * @returns Plan that applies, with planning and command failures together.
 */
export function settleQuireAiEditPlan(
  planning: QuireAiEditPlan,
  operations: readonly unknown[],
  dryRun: (plan: readonly QuireAiPlannedOperation[], report: QuireAiEditReport) => ChainedCommands
): QuireAiEditPlan & { readonly plan: readonly QuireAiPlannedOperation[] } {
  const failures = [...planning.failures];
  let plan = planning.planned;
  while (plan.length > 0) {
    const probe: QuireAiEditReport = { alreadySatisfied: false };
    if (dryRun(plan, probe).run() || probe.failed === undefined) break;
    const source = plan[probe.failed]!.source;
    failures.push({ source, code: "command-rejected", message: `Operation ${source + 1} (${operationName(operations[source])}): could not be applied here; check the target block and values.` });
    plan = plan.filter(entry => entry.source !== source);
  }
  return { planned: plan, plan, failures: failures.sort((left, right) => left.source - right.source), unprocessed: planning.unprocessed };
}

/**
 * Closes a write result: the model reads it last before replying, after a document that may
 * now be in another language than the user's request.
 */
export const quireAiReplyLanguageNote = "Write every message to the user, including notes between tool calls, in the language of their request.";

/** Failure code of a change revision tracking cannot record, which no retry changes. */
export const quireAiUntrackableCode = "untrackable";

/**
 * Writes the model-visible outcome: how many applied, and what to send again.
 * @param outcome - Edit outcome.
 * @returns Result text; when nothing applied, it says the document is unchanged.
 */
export function describeQuireAiEditOutcome(outcome: QuireAiEditOutcome): string {
  const applied = new Set(outcome.plan.map(entry => entry.source)).size;
  const untracked = outcome.untracked === true
    ? "\nWritten directly, not as a tracked change: revision tracking cannot record this change; tell the user it is not among the revisions." : "";
  // A replace_all plans one replacement per occurrence; the model reports how many changed.
  const replaced = new Map<number, number>();
  for (const entry of outcome.plan) if (entry.kind === "replace-text") replaced.set(entry.source, (replaced.get(entry.source) ?? 0) + 1);
  const counts = [...replaced].filter(([, count]) => count > 1).map(([source, count]) => `\nOperation ${source + 1} replaced ${count} occurrences.`).join("");
  if (outcome.failures.length === 0 && outcome.unprocessed === 0) return `Applied ${applied} operation(s).${counts}${untracked}`;
  const lines = [applied === 0
    ? `No operation could be applied; nothing was changed.`
    : `Applied ${applied} of ${outcome.total} operations.${counts}`];
  // A change revision tracking cannot record fails the same way every time; asking for it again only loops.
  const kept = outcome.failures.filter(failure => failure.code === quireAiUntrackableCode);
  const retry = outcome.failures.filter(failure => failure.code !== quireAiUntrackableCode);
  if (retry.length > 0) {
    lines.push("Failed — send only these again, with corrected values:");
    for (const failure of retry.slice(0, reportedFailureLimit)) lines.push(`- ${failure.message}`);
    if (retry.length > reportedFailureLimit) lines.push(`- …and ${retry.length - reportedFailureLimit} more failed operations.`);
  }
  if (kept.length > 0) {
    lines.push("Left as they are — tracked changes cannot record these, so do not send them again; tell the user which content stays:");
    for (const failure of kept.slice(0, reportedFailureLimit)) lines.push(`- ${failure.message}`);
    if (kept.length > reportedFailureLimit) lines.push(`- …and ${kept.length - reportedFailureLimit} more.`);
  }
  if (outcome.unprocessed > 0) {
    lines.push(`Operations ${quireAiEditOperationLimit + 1}–${outcome.total} were not processed: one call takes at most ${quireAiEditOperationLimit}; send them in another call.`);
  }
  return lines.join("\n") + untracked;
}

import { QuireDocumentSdkError } from "../../document-sdk/error";
import type { QuireAiAppliedEdit } from "./apply";
import { describeQuireAiEditOutcome, type QuireAiEditOutcome } from "./settle";
import type { QuireAiModelOperation, QuireAiPlannedOperation, QuireAiStreamState } from "./types";

/**
 * Lists the operations streaming has not handed to the queue: the rest of a partly written insert, then the others.
 * @param operations - Operations as the model wrote them so far.
 * @param state - Call state.
 * @returns Operations still to write.
 */
export function remainingOperations(operations: readonly unknown[], state: QuireAiStreamState): unknown[] {
  const rest = operations.slice(state.doneOperations);
  const first = rest[0] as QuireAiModelOperation | undefined;
  if (first === undefined || state.doneBlocks === 0 || !Array.isArray(first.blocks)) return rest;
  const blocks = first.blocks.slice(state.doneBlocks);
  const continued = blocks.length === 0 ? [] : [{ ...withoutAnchor(first), ...(state.anchors.get(state.doneOperations) ?? anchorOf(first)), blocks }];
  return [...continued, ...rest.slice(1)];
}

/**
 * Combines streamed parts and the final write into one result.
 * @param state - Call state with its parts.
 * @param total - Number of operations the model wrote.
 * @returns Combined write facts.
 */
export function combine(state: QuireAiStreamState, total: number): QuireAiAppliedEdit {
  const plan: QuireAiPlannedOperation[] = [];
  let result: QuireAiAppliedEdit["result"] | null = null;
  let untracked = false;
  for (const part of state.parts) {
    if (part.applied === null) continue;
    if (part.applied.result.applied) result = part.applied.result;
    untracked ||= part.applied.outcome.untracked === true;
    plan.push(...part.applied.outcome.plan.map(entry => ({ ...entry, source: part.source })));
  }
  const failures = state.parts.flatMap(part => part.failures.map(message => ({ source: part.source, code: "command-rejected", message })))
    .sort((left, right) => left.source - right.source);
  const outcome: QuireAiEditOutcome = { total, plan, failures, unprocessed: 0, ...(untracked ? { untracked } : {}) };
  const applied = state.parts.some(part => part.applied?.result.applied === true);
  if (!applied && plan.length === 0) throw new QuireDocumentSdkError("command-rejected", describeQuireAiEditOutcome(outcome));
  return {
    result: result ?? { applied: false, receipt: null, reason: "unchanged" },
    edit: {
      applied: new Set(plan.map(entry => entry.source)).size,
      failed: failures.map(entry => ({ operation: entry.source + 1, message: entry.message })),
      unprocessed: outcome.unprocessed
    },
    outcome,
    alreadySatisfied: !applied
  };
}

/** @param operation - Insert operation. @returns Its anchor fields, or null when none has streamed yet. */
export function anchorOf(operation: QuireAiModelOperation): QuireAiModelOperation | null {
  if (operation.after !== undefined) return { after: operation.after };
  if (operation.before !== undefined) return { before: operation.before };
  if (operation.at !== undefined) return { at: operation.at };
  return null;
}

/** @param operation - Insert operation. @returns The operation without its anchor fields. */
export function withoutAnchor(operation: QuireAiModelOperation): QuireAiModelOperation {
  const { after: _after, before: _before, at: _at, ...rest } = operation;
  return rest;
}

/**
 * @param message - Failure message numbered within one part.
 * @param source - Model operation index.
 * @returns Message numbered as the model wrote the operation.
 */
export function renumber(message: string, source: number): string {
  return message.replace(/^Operation \d+/u, `Operation ${source + 1}`);
}

/**
 * @param error - Error of a write that applied nothing.
 * @returns Its per-operation failure lines, or its message.
 */
export function failureLines(error: unknown): string[] {
  const message = error instanceof Error ? error.message : String(error);
  const lines = message.split("\n").filter(line => line.startsWith("- Operation ")).map(line => line.slice(2));
  return lines.length > 0 ? lines : [`Operation 1: ${message}`];
}

/**
 * @param parent - Container node.
 * @param index - Child index.
 * @returns Offset of the child from the container's content start.
 */
export function offsetOfChild(parent: { child(index: number): { nodeSize: number } }, index: number): number {
  let offset = 0;
  for (let child = 0; child < index; child += 1) offset += parent.child(child).nodeSize;
  return offset;
}

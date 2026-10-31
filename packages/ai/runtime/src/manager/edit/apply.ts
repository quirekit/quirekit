import { materializeQuireAiNestedFormats } from "./materialize";
import { prepareQuireAiActions } from "./prepare";
import { QuireDocumentSdkError } from "../../document-sdk/error";
import type { QuireDocumentToolContext } from "../../document-tools";
import {
  createQuireAiDocumentRevision, createQuireAiEditorChain, QuireAiToolWriteError,
  type QuireAiToolHost, type QuireAiToolWriteResult
} from "../../tool-host";
import type { QuireAiManager } from "../types";
import { appendQuireAiEdit, type QuireAiEditReport } from "./execute";
import { operationName } from "./operation-check";
import { findRemovableQuireAiParent } from "./blocks";
import { planQuireAiEdit } from "./plan";
import { describeQuireAiEditOutcome, quireAiUntrackableCode, settleQuireAiEditPlan, type QuireAiEditOutcome } from "./settle";
import type { QuireAiEditOperationSchema } from "./schema";
import type { QuireAiPlannedOperation } from "./types";

/** What one applied edit came to. */
export interface QuireAiAppliedEdit {
  /** Host write result. */
  readonly result: QuireAiToolWriteResult;
  /** Operations applied, failed and left unprocessed. */
  readonly edit: {
    /** Number of operations applied. */
    readonly applied: number;
    /** Failed operations, numbered from 1, with the reason. */
    readonly failed: readonly { readonly operation: number; readonly message: string }[];
    /** Operations past the per-call limit. */
    readonly unprocessed: number;
  };
  /** Settlement summary for the model-visible outcome text. */
  readonly outcome: QuireAiEditOutcome;
  /** Whether every operation was already in place. */
  readonly alreadySatisfied: boolean;
}

/**
 * Plans, settles and commits a list of edit operations through the guarded host.
 *
 * Each operation is planned and dry-run on its own, refused ones are dropped,
 * and the rest commit as one transaction under the request's execution, so the
 * same path serves the edit tool and batch execution.
 *
 * @param manager - AI manager supplying facts and block identities.
 * @param host - Guarded write authority.
 * @param operation - Strict operation union.
 * @param operations - Operations as the model wrote them.
 * @param context - Operation identity, request and cancellation.
 * @param onPlanned - Receives the settled plan before the write, such as to preview it.
 * @param allowUntrackedFallback - Whether a refused tracked write may fall back to approval.
 * @param isolated - Whether this is already one isolated part, which reports a refusal instead of splitting further.
 * @returns Write facts; throws when no operation can apply.
 */
export async function applyQuireAiEdit(
  manager: QuireAiManager,
  host: QuireAiToolHost,
  operation: QuireAiEditOperationSchema,
  operations: readonly unknown[],
  context: QuireDocumentToolContext,
  onPlanned?: (plan: readonly QuireAiPlannedOperation[]) => void,
  allowUntrackedFallback = true,
  isolated = false
): Promise<QuireAiAppliedEdit> {
  // Pictures and other host work happen before the synchronous chain; failures stay with their operations.
  const prepared = await prepareQuireAiActions(manager, host, operations);
  const baseline = host.read(context.signal, editor => {
    // The settlement dry run fails every command on a read-only editor; report the real cause instead.
    if (!editor.isEditable) throw new QuireAiToolWriteError("editor-read-only", "The editor is read-only; document Tools cannot write.");
    const selection = { from: editor.state.pm.selection.from, to: editor.state.pm.selection.to };
    const planning = materializeQuireAiNestedFormats(
      planQuireAiEdit(operations, { doc: editor.state.doc, registry: manager.registry, identity: manager.identity, operation, prepared,
        tracked: host.peekWrite({ toolCallId: context.callId, capabilityId: "quire.ai.document-edit", target: { kind: "document-blocks", id: "plan" } })?.mode === "tracked" }),
      () => editor.can().chain()
    );
    return {
      revision: createQuireAiDocumentRevision(editor.state.doc),
      selection,
      partitions: partitionQuireAiDeletions(operations, id => {
        const pos = manager.identity.resolve(id);
        const node = pos === null ? null : editor.state.doc.nodeAt(pos);
        if (pos === null || node === null) return null;
        // Containers such as tables go alone; blocks of one removable wrapper go together, apart from the rest.
        if (!node.isTextblock) return `node:${pos}`;
        const wrapper = findRemovableQuireAiParent(editor.state.doc.resolve(pos), manager.registry);
        return wrapper === null ? "" : `wrapper:${wrapper.pos}`;
      }),
      ...settleQuireAiEditPlan(planning, operations, (plan, report) => appendQuireAiEdit(editor.can().chain(), plan, selection, report))
    };
  });
  const outcome: QuireAiEditOutcome = { total: operations.length, plan: baseline.plan, failures: baseline.failures, unprocessed: baseline.unprocessed };
  // Nothing left to apply: the document stays as it is and every reason goes back to the caller.
  if (baseline.plan.length === 0) throw new QuireDocumentSdkError(baseline.failures[0]?.code ?? "invalid-input", describeQuireAiEditOutcome(outcome));
  const sources = [...new Set(baseline.plan.map(entry => entry.source))];
  // Revision admission judges a transaction whole; a refused edit is written again in parts that it admits.
  const divisible = !isolated && (sources.length > 1 || sources.some(source => splitQuireAiOperation(operations[source]) !== null));
  const tracked = !isolated
    && host.peekWrite({ toolCallId: context.callId, capabilityId: "quire.ai.document-edit", target: { kind: "document-blocks", id: baseline.revision } })?.mode === "tracked";
  // Deleting a container block such as a table together with other blocks is never one write.
  if (tracked && baseline.partitions.size > 0) {
    return isolateQuireAiEdit(manager, host, operation, operations, context, sources, outcome, baseline.partitions);
  }
  const report: QuireAiEditReport = { alreadySatisfied: false };
  onPlanned?.(baseline.plan);
  let result: QuireAiToolWriteResult;
  try {
    result = await host.executeWrite({
      toolCallId: context.callId,
      executionId: context.requestId,
      allowUntrackedFallback,
      risk: baseline.plan.some(entry => entry.kind === "action" && entry.action.risk === "policy") ? "policy" : "write",
      capabilityId: "quire.ai.document-edit",
      target: { kind: "document-blocks", id: baseline.revision },
      signal: context.signal,
      expectedDocumentRevision: baseline.revision,
      supportedModes: ["direct", "tracked"],
      checkTarget: editor => createQuireAiDocumentRevision(editor.state.doc) === baseline.revision
        ? { writable: true } : { writable: false, code: "stale-target" },
      canApply: editor => appendQuireAiEdit(editor.can().chain(), baseline.plan, baseline.selection, report).run(),
      apply: (editor, write) => {
        report.author = write.agent;
        return appendQuireAiEdit(createQuireAiEditorChain(editor, write), baseline.plan, baseline.selection, report).run();
      }
    });
  } catch (error) {
    if (divisible && !context.signal.aborted && !(error instanceof QuireAiToolWriteError && error.code === "stale-target")) {
      return isolateQuireAiEdit(manager, host, operation, operations, context, sources, outcome);
    }
    const failed = report.failed;
    if (failed !== undefined && error instanceof QuireAiToolWriteError
      && (error.code === "command-unavailable" || error.code === "command-rejected")) {
      const source = baseline.plan[failed]!.source;
      throw new QuireDocumentSdkError("command-rejected",
        `Operation ${source + 1} (${String((operations[source] as { op?: unknown }).op)}) could not be applied here; nothing was changed. Check the target blocks and values, or split the edit.`);
    }
    throw error;
  }
  if (!result.applied && result.reason === "unchanged" && !report.alreadySatisfied && divisible) {
    return isolateQuireAiEdit(manager, host, operation, operations, context, sources, outcome);
  }
  const edit = {
    applied: sources.length,
    failed: baseline.failures.map(entry => ({ operation: entry.source + 1, message: entry.message })),
    unprocessed: baseline.unprocessed
  };
  const untracked = result.applied && result.receipt.untracked === true;
  return { result, edit, outcome: untracked ? { ...outcome, untracked } : outcome, alreadySatisfied: report.alreadySatisfied };
}

/**
 * Writes each operation on its own after the revision system refused them together.
 *
 * A settlement dry run does not pass through revision admission, which judges a
 * transaction whole; writing operations one by one keeps the ones it admits and
 * reports the rest. Isolated writes never fall back to approval.
 *
 * @param manager - AI manager.
 * @param host - Guarded write authority.
 * @param operation - Strict operation union.
 * @param operations - Operations as the model wrote them.
 * @param context - Operation identity, request and cancellation.
 * @param sources - Indexes of the operations that settled.
 * @param settled - Outcome of the joint attempt, holding its planning failures.
 * @param partitions - Parts some operations are written in from the start, by operation index.
 * @returns Combined write facts, numbered as the model wrote the operations.
 */
async function isolateQuireAiEdit(
  manager: QuireAiManager,
  host: QuireAiToolHost,
  operation: QuireAiEditOperationSchema,
  operations: readonly unknown[],
  context: QuireDocumentToolContext,
  sources: readonly number[],
  settled: QuireAiEditOutcome,
  partitions: ReadonlyMap<number, readonly unknown[]> = new Map()
): Promise<QuireAiAppliedEdit> {
  let result: QuireAiToolWriteResult = { applied: false, receipt: null, reason: "unchanged" };
  const plan: QuireAiPlannedOperation[] = [];
  const failures = [...settled.failures];
  let alreadySatisfied = true;
  let untracked = false;
  /**
   * Writes one operation, halving its block list while revision admission refuses it, so every
   * admitted part stays written and only blocks refused on their own are reported.
   * @param source - Index of the operation as the model wrote it.
   * @param part - The operation or a part of it.
   */
  const settle = async (source: number, part: unknown): Promise<void> => {
    let reason: string;
    let code = "command-rejected";
    try {
      const single = await applyQuireAiEdit(manager, host, operation, [part], context, undefined, false, true);
      if (single.result.applied || single.alreadySatisfied) {
        if (single.result.applied) result = single.result;
        untracked ||= single.outcome.untracked === true;
        alreadySatisfied &&= single.alreadySatisfied;
        plan.push(...single.outcome.plan.map(entry => ({ ...entry, source })));
        return;
      }
      // Only a tracked write is refused by revision admission; a direct one that changed nothing has no such cause.
      const tracked = host.peekWrite({ toolCallId: context.callId, capabilityId: "quire.ai.document-edit", target: { kind: "document-blocks", id: "isolated" } })?.mode === "tracked";
      if (tracked) code = quireAiUntrackableCode;
      reason = tracked
        ? "this change cannot be recorded as a tracked change."
        : "this change leaves the document as it is here; check the target, or tell the user it stays.";
    } catch (error) {
      if (context.signal.aborted) throw error;
      // A block an earlier part already removed is gone, which is what deleting it asks for.
      if ((part as { op?: unknown }).op === "delete" && error instanceof QuireDocumentSdkError && error.code === "stale-target"
        && (part as { blocks: readonly string[] }).blocks.length === 1) return;
      reason = (error instanceof Error ? error.message : String(error)).replace(/^Operation \d+ \([^)]*\): /u, "");
    }
    const halves = splitQuireAiOperation(part);
    if (halves !== null) {
      for (const half of halves) await settle(source, half);
      return;
    }
    const blocks = (part as { blocks?: readonly string[] }).blocks;
    const scope = blocks === undefined || blocks.length === (operations[source] as { blocks?: readonly string[] }).blocks?.length ? "" : ` (block ${blocks.join(", ")})`;
    failures.push({ source, code, message: `Operation ${source + 1} (${operationName(operations[source])})${scope}: ${reason}` });
  };
  for (const source of sources) {
    for (const part of partitions.get(source) ?? [operations[source]]) await settle(source, part);
  }
  failures.sort((left, right) => left.source - right.source);
  const outcome: QuireAiEditOutcome = { ...settled, plan, failures, ...(untracked ? { untracked } : {}) };
  if (plan.length === 0) {
    const untrackable = failures.length > 0 && failures.every(failure => failure.code === quireAiUntrackableCode);
    throw new QuireDocumentSdkError(untrackable ? quireAiUntrackableCode : "command-rejected", describeQuireAiEditOutcome(outcome));
  }
  const edit = {
    applied: new Set(plan.map(entry => entry.source)).size,
    failed: failures.map(entry => ({ operation: entry.source + 1, message: entry.message })),
    unprocessed: settled.unprocessed
  };
  return { result, edit, outcome, alreadySatisfied: alreadySatisfied && !result.applied };
}

/**
 * Splits an operation over several blocks into two operations over halves of its block list.
 * @param operation - Operation as the model wrote it.
 * @returns Two halves, or null when the operation has fewer than two blocks to split.
 */
function splitQuireAiOperation(operation: unknown): readonly unknown[] | null {
  if (operation === null || typeof operation !== "object") return null;
  const candidate = operation as { op?: unknown; blocks?: unknown; after?: unknown; at?: unknown };
  if ((candidate.op !== "delete" && candidate.op !== "format" && candidate.op !== "insert") || !Array.isArray(candidate.blocks) || candidate.blocks.length < 2) return null;
  const middle = Math.ceil(candidate.blocks.length / 2);
  const halves = [{ ...candidate, blocks: candidate.blocks.slice(0, middle) }, { ...candidate, blocks: candidate.blocks.slice(middle) }];
  // Inserting after one anchor or at the body start puts each later write first, so the second half goes in first.
  return candidate.op === "insert" && (candidate.after !== undefined || candidate.at === "start") ? halves.reverse() : halves;
}

/**
 * Plans the parts of delete operations that mix blocks revision tracking must record apart: each
 * container such as a table alone, the blocks of one removable wrapper together, and the plain
 * blocks between them together, in the order of the list.
 * @param operations - Operations as the model wrote them.
 * @param groupOf - Group key of a block id: empty for plain blocks, or null when it no longer exists.
 * @returns Parts by operation index, only for operations that need them.
 */
function partitionQuireAiDeletions(operations: readonly unknown[], groupOf: (id: string) => string | null): Map<number, readonly unknown[]> {
  const partitions = new Map<number, readonly unknown[]>();
  operations.forEach((candidate, index) => {
    const entry = candidate as { op?: unknown; blocks?: unknown };
    if (entry?.op !== "delete" || !Array.isArray(entry.blocks) || entry.blocks.length < 2) return;
    const parts: { key: string; blocks: string[] }[] = [];
    for (const id of entry.blocks as string[]) {
      const key = groupOf(id) ?? "";
      const last = parts.at(-1);
      // Containers never share a part; other keys join the part before when it has the same key.
      if (last !== undefined && last.key === key && !key.startsWith("node:")) last.blocks.push(id);
      else parts.push({ key, blocks: [id] });
    }
    if (parts.length > 1) partitions.set(index, parts.map(part => ({ ...entry, blocks: part.blocks })));
  });
  return partitions;
}

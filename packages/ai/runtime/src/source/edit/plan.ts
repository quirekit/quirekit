import type { TSchema } from "typebox";
import { Check } from "typebox/value";
import type { QuireAiSourceCommandDescriptor } from "@quirekit/ai-contract";
import { describeOperationMismatch, operationName } from "../../manager/edit/operation-check";
import type { QuireAiEditOperationSchema } from "../../manager/edit/schema";
import { mapQuireAiSourcePosThrough } from "../changes/map";
import type { QuireAiSourceStep } from "../types";
import { planQuireAiSourceCommand, type QuireAiSourceCommandScope } from "./commands";
import { QuireAiSourceDraft, QuireAiSourceOperationFailure } from "./draft";
import { planQuireAiSourceCoreOperation, type QuireAiSourceCoreOperation } from "./operations";
import { quireAiSourceEditOperationLimit } from "./schema";

/** What one operation came to. */
export interface QuireAiSourcePlannedOperation {
  /** Index of the operation in the model's list. */
  readonly source: number;
  /** Occurrences replaced by a replace_all; otherwise 1. */
  readonly occurrences: number;
  /** Whether its state was already in place, so it wrote nothing. */
  readonly satisfied: boolean;
}

/** One operation that failed, numbered from 0. */
export interface QuireAiSourceEditFailure {
  /** Index of the operation in the model's list. */
  readonly source: number;
  /** Failure classification. */
  readonly code: string;
  /** Model-facing reason, naming the operation. */
  readonly message: string;
}

/** A planned edit. */
export interface QuireAiSourcePlan {
  /** Steps of every planned operation, in order. */
  readonly steps: readonly QuireAiSourceStep[];
  /** Operations that apply. */
  readonly operations: readonly QuireAiSourcePlannedOperation[];
  /** Operations that failed. */
  readonly failures: readonly QuireAiSourceEditFailure[];
  /** Operations past the per-call limit. */
  readonly unprocessed: number;
  /** Text after the edit. */
  readonly text: string;
  /** Position of the first change in the text after the edit, or null without changes. */
  readonly firstChange: number | null;
}

/** Facts an edit is planned with. */
export interface QuireAiSourcePlanScope extends Omit<QuireAiSourceCommandScope, "draft"> {
  /** Described commands by name. */
  readonly commands: ReadonlyMap<string, QuireAiSourceCommandDescriptor>;
  /** Strict operation union. */
  readonly operation: TSchema;
  /** Prepared values of commands with `prepare`, by operation index. */
  readonly prepared: ReadonlyMap<number, unknown>;
  /** Operations that failed preparation or a check before planning, with the reason. */
  readonly blocked?: ReadonlyMap<number, string> | undefined;
}

/**
 * Plans operations one after another on the snapshot the model read. Each operation fails
 * alone: its steps are dropped and the rest still apply.
 * @param operations - Operations from the model.
 * @param scope - Snapshot, port, commands and identities.
 * @param offset - Index of the first operation in the model's whole list, when planning a part of it.
 * @returns Steps, outcomes and failures.
 */
export function planQuireAiSourceEdit(operations: readonly unknown[], scope: QuireAiSourcePlanScope, offset = 0): QuireAiSourcePlan {
  const draft = new QuireAiSourceDraft(scope.snapshot.text);
  const planned: QuireAiSourcePlannedOperation[] = [];
  const failures: QuireAiSourceEditFailure[] = [];
  const limit = Math.max(0, quireAiSourceEditOperationLimit - offset);
  operations.slice(0, limit).forEach((candidate, index) => {
    const source = offset + index;
    const name = operationName(candidate);
    const fail = (code: string, message: string) => failures.push({ source, code, message: `Operation ${source + 1} (${name}): ${message}` });
    if (!Check(scope.operation, candidate)) {
      fail("invalid-input", describeOperationMismatch(scope.operation as unknown as QuireAiEditOperationSchema, candidate, name));
      return;
    }
    const reason = scope.blocked?.get(source);
    if (reason !== undefined) {
      fail("invalid-input", `${reason}.`.replace(/\.\.$/u, "."));
      return;
    }
    const operation = candidate as QuireAiSourceCoreOperation;
    const descriptor = scope.commands.get(operation.op);
    if (descriptor?.standalone === true && operations.length > 1) {
      fail("invalid-input", "send this command in its own document_edit call.");
      return;
    }
    const mark = draft.mark();
    try {
      if (descriptor === undefined) {
        planned.push({ source, occurrences: planQuireAiSourceCoreOperation({ draft, snapshot: scope.snapshot, document: scope.document }, operation), satisfied: false });
      } else {
        const wrote = planQuireAiSourceCommand({ ...scope, draft }, operation, descriptor, scope.prepared.get(source));
        planned.push({ source, occurrences: 1, satisfied: !wrote });
      }
    } catch (error) {
      if (!(error instanceof QuireAiSourceOperationFailure)) throw error;
      draft.reset(mark);
      fail(error.code, error.message);
    }
  });
  return {
    steps: draft.steps, operations: planned, failures, unprocessed: Math.max(0, operations.length - limit), text: draft.text,
    firstChange: firstChange(draft)
  };
}

/** @param draft - Planned draft. @returns Position of its first change in the final text, or null. */
function firstChange(draft: QuireAiSourceDraft): number | null {
  let first: number | null = null;
  draft.sets.forEach((changes, index) => {
    if (changes.length === 0) return;
    const pos = mapQuireAiSourcePosThrough(draft.sets.slice(index + 1), changes[0]!.from, -1);
    first = first === null ? pos : Math.min(first, pos);
  });
  return first;
}

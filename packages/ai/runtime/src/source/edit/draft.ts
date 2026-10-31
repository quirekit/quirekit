import { applyQuireAiSourceChanges, mapQuireAiSourcePosThrough, normalizeQuireAiSourceChanges } from "../changes/map";
import type { QuireAiSourceChangeSet, QuireAiSourceStep } from "../types";
import type { QuireAiSourceViewBlock } from "../view/types";

/** A failure of one operation, with the code and model-facing reason. */
export class QuireAiSourceOperationFailure extends Error {
  /** Failure classification: `stale-target`, `invalid-input` or `command-rejected`. */
  readonly code: string;

  /**
   * @param code - Failure classification.
   * @param message - Reason, without the operation number.
   */
  constructor(code: string, message: string) {
    super(message);
    this.name = "QuireAiSourceOperationFailure";
    this.code = code;
  }
}

/** Block positions in the draft's current coordinates. */
export interface QuireAiDraftBlock {
  /** Start of the block's own source. */
  readonly from: number;
  /** End of the block's own source. */
  readonly to: number;
  /** End including nested blocks. */
  readonly end: number;
  /** Where content inserted after the block goes: after it and after what earlier operations put there. */
  readonly after: number;
}

/**
 * Text an edit is planned on, with the steps that lead to it.
 *
 * Operations are planned one after another against the snapshot the model read; every step is
 * kept as a change set so snapshot positions map to the current draft, as if each operation
 * had been written right after the previous one.
 */
export class QuireAiSourceDraft {
  /** Current text. */
  text: string;
  /** Steps in order. */
  readonly steps: QuireAiSourceStep[] = [];
  /** Text changes of each step, in order. */
  readonly sets: QuireAiSourceChangeSet[] = [];

  /** @param text - Snapshot text. */
  constructor(text: string) {
    this.text = text;
  }

  /** @param pos - Snapshot position. @param assoc - Side to stick to. @returns Current position. */
  map(pos: number, assoc: -1 | 1): number {
    return mapQuireAiSourcePosThrough(this.sets, pos, assoc);
  }

  /**
   * @param block - Snapshot block.
   * @returns Its current positions.
   * @throws QuireAiSourceOperationFailure when an earlier operation removed it.
   */
  locate(block: QuireAiSourceViewBlock): QuireAiDraftBlock {
    const from = this.map(block.from, 1);
    const to = this.map(block.to, -1);
    if (to <= from) throw new QuireAiSourceOperationFailure("stale-target", `${block.id} was removed by an earlier operation of this call.`);
    const end = Math.max(to, this.map(block.end, -1));
    return { from, to, end, after: Math.max(end, this.map(block.end, 1)) };
  }

  /** @param block - Snapshot block. @returns Whether an earlier operation of this call left it in place. */
  alive(block: QuireAiSourceViewBlock): boolean {
    return this.map(block.to, -1) > this.map(block.from, 1);
  }

  /** @param changes - Text replacements in current coordinates. */
  change(changes: QuireAiSourceChangeSet): void {
    const normalized = normalizeQuireAiSourceChanges(changes.filter(change => change.from !== change.to || change.insert !== ""));
    if (normalized === null) throw new QuireAiSourceOperationFailure("invalid-input", "two changes of the operation overlap.");
    if (normalized.length === 0) return;
    this.steps.push({ kind: "changes", changes: normalized });
    this.sets.push(normalized);
    this.text = applyQuireAiSourceChanges(this.text, normalized);
  }

  /**
   * @param step - Command step.
   * @param changes - Text it changes, as the editor planned it.
   * @param text - Text after it.
   */
  command(step: QuireAiSourceStep, changes: QuireAiSourceChangeSet, text: string): void {
    this.steps.push(step);
    this.sets.push(changes);
    this.text = text;
  }

  /** @returns Mark to roll an operation back to. */
  mark(): { readonly steps: number; readonly text: string } {
    return { steps: this.steps.length, text: this.text };
  }

  /** @param mark - Mark taken before a failed operation. */
  reset(mark: { readonly steps: number; readonly text: string }): void {
    this.steps.length = mark.steps;
    this.sets.length = mark.steps;
    this.text = mark.text;
  }
}

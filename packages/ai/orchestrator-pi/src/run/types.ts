import type { QuireAiPiErrorCode } from "../errors";
import type { QuireAiPiRunResult } from "../types";

/** Run-local cancellation authority, retained independently of Pi's live signal. */
export interface PiRunControl {
  /** Signal observed by SDK calls as well as the native Pi operation. */
  readonly signal: AbortSignal;
  /** Stable reason retained after native settlement. */
  readonly reason: QuireAiPiErrorCode | undefined;
  /**
   * Requests native durable cancellation without forgetting the first cause.
   * @param reason - Stable local termination reason.
   * @returns Settlement of the durable cancellation request.
   */
  cancel(reason: "cancelled" | "timeout" | PiRunBudgetStop): Promise<void>;
  /** Starts or refreshes the provider-only idle timer. */
  touchProvider(): void;
  /** Stops timing while Pi executes tools or waits for human input. */
  stopProvider(): void;
  /** Removes timers and caller subscriptions. */
  dispose(): void;
}

/** Synchronously reserved run slot, including asynchronous session initialization. */
export interface ActivePiRun {
  /** Aborts the run even before a native operation has been admitted. */
  readonly abort: () => void;
  /** Full settlement, including SDK operations and event delivery. */
  readonly settled: Promise<QuireAiPiRunResult>;
}

/** Budget reason that stops a run before another model request. */
export type PiRunBudgetStop = "turn-budget-exceeded" | "no-progress";

/** Model-request bounds of one run. */
export interface PiRunBudgetLimits {
  /** Hard bound on model requests, whatever progress they make. */
  readonly maxModelTurns: number;
  /** Consecutive turns without document progress that end the run; undefined disables the check. */
  readonly maxIdleTurns?: number | undefined;
}

/** Run-local accounting of model requests and the document progress of their tool calls. */
export interface PiRunBudget {
  /**
   * Records a started tool call.
   * @param toolCallId - Provider-issued call identity.
   * @param toolName - Invoked tool.
   * @param args - Parsed call arguments.
   */
  start(toolCallId: string, toolName: string, args: unknown): void;
  /**
   * Classifies a settled tool call as progress or not.
   * @param toolCallId - Provider-issued call identity.
   * @param isError - Whether the call failed.
   */
  end(toolCallId: string, isError: boolean): void;
  /**
   * Admits the next model request.
   * @returns Stop reason, or undefined when the request may proceed.
   */
  admit(): PiRunBudgetStop | undefined;
}

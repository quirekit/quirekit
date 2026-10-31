import type { AgentLane } from "@earendil-works/pi-agent-core";
import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core/harness/context";
import type { PiRunBudgetStop, PiRunControl } from "./types";

/**
 * Connects caller cancellation to durable Pi control and provider-only idle bounds.
 * @param lane - Native lane driving this request.
 * @param runId - Admitted native operation identity.
 * @param signal - Caller-owned run cancellation.
 * @param timeoutMs - Provider idle deadline, excluding tools and human input.
 * @returns Cancellation and timer authority retained through settlement.
 */
export function createPiRunControl(lane: AgentLane, runId: string, signal: AbortSignal, timeoutMs: number): PiRunControl {
  const controller = new AbortController();
  let reason: PiRunControl["reason"];
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Clears the provider timer after response completion. */
  function stopProvider(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  /**
   * Closes the SDK signal synchronously before requesting durable Pi cancellation.
   * @param cause - Stable termination cause.
   * @returns Completion of the native cancellation write.
   */
  async function cancel(cause: "cancelled" | "timeout" | PiRunBudgetStop): Promise<void> {
    reason ??= cause;
    stopProvider();
    controller.abort();
    await lane.requestAbort(runId, BACKGROUND_CONTEXT);
  }
  /** Forwards caller cancellation without throwing into an event dispatch. */
  function forwardAbort(): void {
    void cancel("cancelled").catch(() => undefined);
  }
  signal.addEventListener("abort", forwardAbort, { once: true });
  if (signal.aborted) forwardAbort();
  return {
    signal: controller.signal,
    get reason() { return reason; },
    cancel,
    touchProvider() {
      stopProvider();
      if (controller.signal.aborted) return;
      timer = setTimeout(() => {
        void cancel("timeout").catch(() => undefined);
      }, timeoutMs);
    },
    stopProvider,
    dispose() {
      stopProvider();
      signal.removeEventListener("abort", forwardAbort);
    }
  };
}

import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core/harness/context";
import { QuireAiPiError } from "./errors";
import { executePiRun, type ActivePiRun } from "./run";
import { createPiSessionController } from "./session";
import type { QuireAiAgentCoordinator, QuireAiPiCoordinatorOptions } from "./types";

/**
 * Creates one persistent Pi conversation consuming the public Document SDK.
 * @param options - Native provider runtime, instruction, bounds and persistence.
 * @returns Conversation lifecycle whose only Agent loop is Pi Harness.
 */
export function createQuireAiPiCoordinator(options: QuireAiPiCoordinatorOptions): QuireAiAgentCoordinator {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxModelTurns = options.maxModelTurns ?? 8;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError("The provider idle timeout must be a positive integer.");
  if (!Number.isInteger(maxModelTurns) || maxModelTurns < 1 || maxModelTurns > 64) throw new TypeError("The model-turn budget must be an integer from 1 to 64.");
  const maxIdleTurns = options.maxIdleTurns;
  if (maxIdleTurns !== undefined && (!Number.isInteger(maxIdleTurns) || maxIdleTurns < 1 || maxIdleTurns > maxModelTurns)) {
    throw new TypeError("The idle-turn budget must be an integer from 1 to the model-turn budget.");
  }
  const sessions = createPiSessionController(options);
  let active: ActivePiRun | undefined;
  let closed = false;
  let resetting: Promise<void> | undefined;

  /** @returns Settlement of all effects admitted by the current run. */
  async function waitForIdle(): Promise<void> {
    await active?.settled.catch(() => undefined);
  }

  return {
    run(request) {
      if (closed) return Promise.reject(new QuireAiPiError("closed", "The document conversation is closed."));
      if (active !== undefined || resetting !== undefined) return Promise.reject(new QuireAiPiError("busy", "The document conversation already has active work."));
      const cancellation = new AbortController();
      const signal = AbortSignal.any([request.signal, cancellation.signal]);
      // Reserve before asynchronous initialization so two submissions cannot both
      // capture targets or enter the native admission transaction.
      const settled = Promise.resolve().then(() => executePiRun(sessions, request, signal, timeoutMs, { maxModelTurns, maxIdleTurns }));
      const slot: ActivePiRun = { abort: () => cancellation.abort(), settled };
      active = slot;
      return settled.finally(() => { if (active === slot) active = undefined; });
    },
    abort() { active?.abort(); },
    waitForIdle,
    reset() {
      if (closed) return Promise.reject(new QuireAiPiError("closed", "The document conversation is closed."));
      if (resetting !== undefined) return resetting;
      active?.abort();
      resetting = waitForIdle().then(() => sessions.reset()).finally(() => { resetting = undefined; });
      return resetting;
    },
    async close() {
      if (closed) return;
      closed = true;
      active?.abort();
      await waitForIdle();
      await resetting;
      await sessions.close();
    },
    async getTranscript() {
      const state = await sessions.get();
      const entries = await state.lane.findEntries(undefined, BACKGROUND_CONTEXT);
      return Object.freeze(structuredClone(entries.reverse().flatMap(entry => entry.type === "message" ? [entry.message] : [])));
    },
    async getSessionId() { return (await sessions.get()).session.metadata.id; }
  };
}

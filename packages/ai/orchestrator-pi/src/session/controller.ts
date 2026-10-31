import { AgentHarness, MemorySessionRepo } from "@earendil-works/pi-agent-core";
import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core/harness/context";
import { createModels } from "@earendil-works/pi-ai";
import { QuireAiPiError } from "../errors";
import type { QuireAiPiCoordinatorOptions, QuireAiPiModelRuntime } from "../types";
import type { PiSessionController, PiSessionState } from "./types";
import { modelCompactionSettings } from "./configuration";

/**
 * Keeps complete Pi state across requests and isolates provider changes from history.
 * @param options - Runtime and optional application persistence adapter.
 * @returns Lazy native session owner.
 */
export function createPiSessionController(options: QuireAiPiCoordinatorOptions): PiSessionController {
  const models = createModels();
  const memory = new MemorySessionRepo();
  let runtime: QuireAiPiModelRuntime = options;
  let systemPrompt = options.systemPrompt;
  let pending: Promise<PiSessionState> | undefined;
  let previousSessionId: string | undefined;
  let fresh = false;
  let closed = false;

  /** @returns Initialized native state with interrupted work reconciled safely. */
  async function initialize(): Promise<PiSessionState> {
    registerRuntime(runtime);
    const session = options.openSession === undefined
      ? await memory.create({}, BACKGROUND_CONTEXT)
      : await options.openSession({ fresh, previousSessionId });
    const { harness, open } = await AgentHarness.create<undefined>({
      session,
      models,
      model: runtime.model,
      thinkingLevel: runtime.thinkingLevel ?? "off",
      systemPrompt: () => systemPrompt,
      toolExecution: "sequential",
      compaction: modelCompactionSettings(runtime.model)
    }, BACKGROUND_CONTEXT);
    // Persisted model state may outlive editor targets. Reconcile interrupted work
    // through Pi before accepting new input; never replay a document write blindly.
    for (const operation of open) {
      const interruptedLane = await harness.lane(operation.lane, BACKGROUND_CONTEXT);
      await interruptedLane.requestAbort(operation.operationId, BACKGROUND_CONTEXT);
      await interruptedLane.drive({ operationId: operation.operationId }, BACKGROUND_CONTEXT);
    }
    return { session, harness, lane: await harness.lane("document", BACKGROUND_CONTEXT) };
  }

  /**
   * Installs the selected real Pi provider without copying credentials.
   * @param selected - Application-selected native runtime.
   */
  function registerRuntime(selected: QuireAiPiModelRuntime): void {
    const provider = selected.models.getProvider(selected.model.provider);
    if (provider === undefined) throw new QuireAiPiError("provider-failed", "The selected model provider is unavailable.");
    models.setProvider(provider);
  }

  /** @returns Shared initialization promise. */
  function get(): Promise<PiSessionState> {
    if (closed) return Promise.reject(new QuireAiPiError("closed", "The document conversation is closed."));
    if (pending === undefined) {
      const attempt = initialize();
      pending = attempt;
      void attempt.catch(() => { if (pending === attempt) pending = undefined; });
    }
    return pending;
  }

  /** @returns Settlement after closing the current session handle. */
  async function release(): Promise<void> {
    const current = pending;
    pending = undefined;
    if (current === undefined) return;
    const state = await current;
    previousSessionId = state.session.metadata.id;
    await state.harness.close(BACKGROUND_CONTEXT);
  }

  return {
    get,
    async configure(selected, instruction) {
      if (selected !== undefined) runtime = selected;
      if (instruction !== undefined) systemPrompt = instruction;
      registerRuntime(runtime);
      const state = await get();
      await state.lane.setModel({ provider: runtime.model.provider, modelId: runtime.model.id }, BACKGROUND_CONTEXT);
      await state.lane.setThinkingLevel(runtime.thinkingLevel ?? "off", BACKGROUND_CONTEXT);
      await state.harness.setCompactionSettings(modelCompactionSettings(runtime.model), BACKGROUND_CONTEXT);
      return state;
    },
    async reset() {
      if (closed) throw new QuireAiPiError("closed", "The document conversation is closed.");
      await release();
      fresh = true;
    },
    async close() {
      if (closed) return;
      closed = true;
      await release();
      await memory.close(BACKGROUND_CONTEXT);
    }
  };
}

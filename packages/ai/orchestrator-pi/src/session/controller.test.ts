import { MemorySessionRepo } from "@earendil-works/pi-agent-core";
import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core/harness/context";
import { createModels, fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { createTestRuntime } from "../testing/fixtures";
import { createPiSessionController } from "./controller";

describe("native session configuration", () => {
  it("scales compaction when switching an existing conversation to a smaller model", async () => {
    const { runtime } = createTestRuntime([]);
    const sessions = createPiSessionController({ ...runtime, systemPrompt: "Document conversation." });
    const initial = await sessions.get();
    const previous = await initial.harness.getCompactionSettings(BACKGROUND_CONTEXT);
    const small = fauxProvider({ provider: "small", models: [{ id: "small-model", contextWindow: 8192, maxTokens: 1024 }] });
    small.setResponses([fauxAssistantMessage("Small model ready.")]);
    const models = createModels();
    models.setProvider(small.provider);
    const model = small.getModel();
    const configured = await sessions.configure({ models, model, streamFn: models.streamSimple.bind(models) });
    const settings = await configured.harness.getCompactionSettings(BACKGROUND_CONTEXT);
    expect(configured.session.metadata.id).toBe(initial.session.metadata.id);
    expect(settings.reserveTokens).toBeLessThan(previous.reserveTokens);
    expect(settings.keepRecentTokens).toBeLessThan(previous.keepRecentTokens);
    expect(settings.reserveTokens + settings.keepRecentTokens).toBeLessThan(model.contextWindow);
    expect(await configured.lane.getModel(BACKGROUND_CONTEXT)).toMatchObject({ id: model.id });
    const admission = await configured.lane.accept({ kind: "prompt", operationId: "small-window", prompt: "Hello" }, BACKGROUND_CONTEXT);
    expect(admission.ok).toBe(true);
    const driven = await configured.lane.drive({ operationId: "small-window" }, BACKGROUND_CONTEXT);
    expect(driven).toMatchObject({ ok: true, value: { kind: "settled", outcome: { status: "completed" } } });
    expect(small.state.callCount).toBe(1);
    await sessions.close();
  });

  it("permits retry after an application session store temporarily fails to open", async () => {
    const { runtime } = createTestRuntime([]);
    const repository = new MemorySessionRepo();
    const openSession = vi.fn().mockRejectedValueOnce(new Error("Store temporarily unavailable"))
      .mockImplementation(() => repository.create({}, BACKGROUND_CONTEXT));
    const sessions = createPiSessionController({ ...runtime, systemPrompt: "Test", openSession });
    await expect(sessions.get()).rejects.toThrow("Store temporarily unavailable");
    await expect(sessions.get()).resolves.toHaveProperty("session");
    expect(openSession).toHaveBeenCalledTimes(2);
    await sessions.close();
    await repository.close(BACKGROUND_CONTEXT);
  });
});

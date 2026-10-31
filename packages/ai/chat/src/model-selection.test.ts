import { describe, expect, it } from "vitest";
import {
  createAiChatModelOptions,
  resolveAiChatSelectedModel
} from "./model-selection";

const primary = {
  id: "deepseek-v4-flash",
  label: "DeepSeek V4 Flash",
  provider: "DeepSeek",
  capabilities: { vision: false }
} as const;

describe("AI Chat model selection", () => {
  it("keeps the primary model first and deduplicates Host profiles", () => {
    const models = createAiChatModelOptions(primary, [
      { ...primary, label: "Duplicate" },
      {
        id: "host-model",
        label: "Host model",
        provider: "Host",
        capabilities: { vision: true }
      }
    ]);

    expect(models.map(({ id }) => id)).toEqual([
      "deepseek-v4-flash",
      "host-model"
    ]);
    expect(models[0]?.label).toBe("DeepSeek V4 Flash");
  });

  it("restores a known model and falls back for stale persistence", () => {
    const models = createAiChatModelOptions(primary, [{
      id: "host-model",
      label: "Host model",
      provider: "Host",
      capabilities: { vision: true }
    }]);

    expect(resolveAiChatSelectedModel(models, "host-model").id).toBe("host-model");
    expect(resolveAiChatSelectedModel(models, "removed-model").id).toBe(
      "deepseek-v4-flash"
    );
  });
});

import type { AiChatModelDescriptor } from "./types";

/**
 * Creates a stable deduplicated application model list.
 *
 * @param primary - Required initial model.
 * @param available - Additional Host-configured models.
 * @returns Model list with the primary model first.
 */
export function createAiChatModelOptions(
  primary: AiChatModelDescriptor,
  available: readonly AiChatModelDescriptor[] = []
): readonly AiChatModelDescriptor[] {
  const models = new Map<string, AiChatModelDescriptor>();
  models.set(primary.id, primary);
  for (const model of available) {
    if (!models.has(model.id)) models.set(model.id, model);
  }
  return Object.freeze([...models.values()]);
}

/**
 * Resolves a selected model id with a safe primary fallback.
 *
 * @param models - Configured model options.
 * @param selectedId - Selected or persisted model id.
 * @returns Selected model or the first configured model.
 */
export function resolveAiChatSelectedModel(
  models: readonly AiChatModelDescriptor[],
  selectedId: string | undefined
): AiChatModelDescriptor {
  const fallback = models[0];
  if (fallback === undefined) {
    throw new TypeError("AI Chat requires at least one model descriptor.");
  }
  return models.find(({ id }) => id === selectedId) ?? fallback;
}

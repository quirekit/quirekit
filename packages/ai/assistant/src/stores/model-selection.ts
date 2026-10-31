import type { AiChatModelSelectionStore } from "@quirekit/ai-chat";

const modelSelectionStorageKey = "quirekit.ai.selected-model.v1";

/**
 * Creates browser persistence for the selected application model profile.
 *
 * @param storage - Browser-local storage authority.
 * @returns Fail-soft model selection store.
 */
export function createQuireAiModelSelectionStore(
  storage: Storage
): AiChatModelSelectionStore {
  return Object.freeze({
    async loadSelectedModelId() {
      const value = storage.getItem(modelSelectionStorageKey)?.trim();
      return value === undefined || value.length === 0 || value.length > 160
        ? undefined
        : value;
    },
    async saveSelectedModelId(modelId: string) {
      if (modelId.length > 0 && modelId.length <= 160) {
        storage.setItem(modelSelectionStorageKey, modelId);
      }
    }
  });
}

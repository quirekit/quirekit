import type {
  AiChatAuthorizationMode,
  AiChatAuthorizationModeStore
} from "@quirekit/ai-chat";

const authorizationStorageKey = "quirekit.ai.authorization-mode.v1";

/**
 * Creates local browser persistence for the explicit AI authorization preset.
 *
 * @param storage - Browser-local storage authority.
 * @returns Fail-safe request-approval preference store.
 */
export function createQuireAiAuthorizationModeStore(
  storage: Storage
): AiChatAuthorizationModeStore {
  return Object.freeze({
    async loadAuthorizationMode() {
      const value = storage.getItem(authorizationStorageKey);
      return isAuthorizationMode(value) ? value : undefined;
    },
    async saveAuthorizationMode(mode: AiChatAuthorizationMode) {
      storage.setItem(authorizationStorageKey, mode);
    }
  });
}

/**
 * Checks one stored string without accepting legacy or model-authored values.
 *
 * @param value - Stored browser preference.
 * @returns Whether the value is an exact authorization preset.
 */
function isAuthorizationMode(value: string | null): value is AiChatAuthorizationMode {
  return value === "request-approval"
    || value === "full-access";
}

import { createApp, shallowReactive } from "vue";
import QuireAiProviderSettings from "./provider-settings.vue";
import {
  clearQuireAiProviderSettings,
  loadQuireAiProviderSettings,
  saveQuireAiProviderSettings
} from "./storage";
import type {
  CreateQuireAiProviderSettingsOptions,
  QuireAiProviderSettingsDraft,
  QuireAiProviderSettingsHandle,
  QuireAiResolvedProviderConnection
} from "./types";
import { validateQuireAiProviderSettings } from "./validate";

/**
 * Creates the local provider configuration surface and bootstrap snapshot.
 *
 * @param options - DOM, storage, default Host, and reconnect authorities.
 * @returns Settings action consumed by the Chat header and application bootstrap.
 */
export function createQuireAiProviderSettings(
  options: CreateQuireAiProviderSettingsOptions
): QuireAiProviderSettingsHandle {
  const loaded = options.persistence
    ? { draft: options.persistence.initialDraft, configured: true }
    : loadQuireAiProviderSettings(options.storage, options.defaultHostUrl);
  const initialDraft = loaded.draft;
  const connection = resolveInitialConnection(
    loaded.configured,
    initialDraft,
    options.defaultHostUrl
  );
  const state = shallowReactive({ open: false, busy: false, error: "" });
  const host = options.ownerDocument.createElement("div");
  host.className = "qk-classic-ai-provider-settings-mount";
  options.ownerDocument.body.append(host);
  const app = createApp(QuireAiProviderSettings, {
    state,
    initialDraft,
    managed: options.persistence ? options.persistence.scope ?? "team" : undefined,
    onClose: () => { if (!state.busy) state.open = false; },
    onSave: (draft: QuireAiProviderSettingsDraft) => persist(async () => {
      const validated = validateQuireAiProviderSettings(draft);
      if (options.persistence) await options.persistence.save(validated);
      else saveQuireAiProviderSettings(options.storage, validated);
    }),
    onClear: () => persist(async () => {
      if (options.persistence) await options.persistence.clear();
      else clearQuireAiProviderSettings(options.storage);
    })
  });
  // 页面上可能同时有多个 Vue 应用，id 前缀避免组件按 id 查找时找到别的应用的元素。
  app.config.idPrefix = `qk-ai-provider-settings-${Array.from(globalThis.crypto.getRandomValues(new Uint32Array(2)), value => value.toString(36)).join("-")}`;
  app.mount(host);

  /** @param write - Persistence operation; failures preserve the editable draft. */
  async function persist(write: () => Promise<void>): Promise<void> {
    if (state.busy) return;
    state.busy = true; state.error = "";
    try {
      await write();
      state.open = false;
      options.reconnect();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "保存配置失败，请重试。";
    } finally { state.busy = false; }
  }

  return {
    connection,
    open() {
      state.open = true;
    },
    destroy() {
      app.unmount();
      host.remove();
    }
  };
}

/**
 * Resolves the current page connection without treating the Host as mandatory.
 *
 * @param configured - Whether the user explicitly saved settings.
 * @param draft - Loaded settings and credential.
 * @param defaultHostUrl - Existing application Host fallback.
 * @returns Browser-direct, Host, or local validation connection.
 */
function resolveInitialConnection(
  configured: boolean,
  draft: QuireAiProviderSettingsDraft,
  defaultHostUrl: string
): QuireAiResolvedProviderConnection {
  if (!configured) {
    return defaultHostUrl.trim().length === 0
      ? { mode: "local" }
      : { mode: "host", hostUrl: defaultHostUrl };
  }
  try {
    const validated = validateQuireAiProviderSettings(draft);
    if (validated.mode === "browser") {
      return {
        mode: "browser",
        catalog: {
          defaultProfileId: validated.defaultProfileId,
          profiles: validated.profiles.map((profile) => ({
            id: profile.id,
            protocol: profile.protocol,
            baseUrl: profile.baseUrl,
            authScheme: profile.authScheme,
            apiKey: profile.apiKey,
            model: profile.model,
            providerLabel: profile.providerLabel,
            maxOutputTokens: profile.maxOutputTokens,
            contextWindowTokens: profile.contextWindowTokens,
            contextBudgetPercent: profile.contextBudgetPercent,
            thinkingLevel: profile.thinkingLevel
          }))
        }
      };
    }
    if (validated.mode === "host") {
      return { mode: "host", hostUrl: validated.hostUrl };
    }
    return { mode: "local" };
  } catch {
    return { mode: "local" };
  }
}

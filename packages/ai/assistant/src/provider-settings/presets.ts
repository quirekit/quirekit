import type { QuireAiBrowserModelDraft, QuireAiProviderPreset } from "./types";

/** Official editable presets bundled for common model connections. */
export const quireAiProviderPresets: readonly QuireAiProviderPreset[] = Object.freeze([
  Object.freeze({
    id: "deepseek",
    label: "DeepSeek",
    protocol: "openai-completions",
    baseUrl: "https://api.deepseek.com",
    authScheme: "bearer",
    model: "deepseek-flash",
    providerLabel: "DeepSeek",
    contextWindowTokens: 1_000_000,
    thinkingLevel: "high"
  }),
  Object.freeze({
    id: "qwen",
    label: "Qwen",
    protocol: "openai-completions",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    authScheme: "bearer",
    model: "qwen3.7-plus",
    providerLabel: "Qwen",
    contextWindowTokens: 1_000_000,
    thinkingLevel: "off"
  }),
  Object.freeze({
    id: "mimo",
    label: "MiMo",
    protocol: "openai-responses",
    baseUrl: "https://api.xiaomimimo.com/v1",
    authScheme: "api-key",
    model: "mimo-v2.5-pro",
    providerLabel: "MiMo",
    contextWindowTokens: 1_000_000,
    thinkingLevel: "high"
  }),
  Object.freeze({
    id: "openai",
    label: "OpenAI",
    protocol: "openai-responses",
    baseUrl: "https://api.openai.com/v1",
    authScheme: "bearer",
    model: "gpt-5.4",
    providerLabel: "OpenAI",
    contextWindowTokens: 400_000,
    thinkingLevel: "high"
  }),
  Object.freeze({
    id: "anthropic",
    label: "Anthropic",
    protocol: "anthropic-messages",
    baseUrl: "https://api.anthropic.com",
    authScheme: "x-api-key",
    model: "claude-opus-4-6",
    providerLabel: "Anthropic",
    contextWindowTokens: 200_000,
    thinkingLevel: "high"
  })
]);

/**
 * Creates one editable profile from a built-in preset.
 *
 * @param preset - Built-in provider defaults.
 * @param id - Stable profile identity owned by the settings document.
 * @returns Editable profile with safe context headroom.
 */
export function createQuireAiProfileFromPreset(
  preset: QuireAiProviderPreset,
  id = `profile-${preset.id}`
): QuireAiBrowserModelDraft {
  return {
    id,
    protocol: preset.protocol,
    baseUrl: preset.baseUrl,
    authScheme: preset.authScheme,
    apiKey: "",
    model: preset.model,
    providerLabel: preset.providerLabel,
    maxOutputTokens: 32_768,
    contextWindowTokens: preset.contextWindowTokens,
    contextBudgetPercent: 70,
    thinkingLevel: preset.thinkingLevel
  };
}

/**
 * Resolves one built-in preset by identity.
 *
 * @param id - Preset identity selected by the user.
 * @returns Matching preset or undefined.
 */
export function findQuireAiProviderPreset(
  id: string
): QuireAiProviderPreset | undefined {
  return quireAiProviderPresets.find(preset => preset.id === id);
}

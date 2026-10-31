import {
  createQuireAiProfileFromPreset,
  quireAiProviderPresets
} from "./presets";
import type {
  QuireAiBrowserModelDraft,
  QuireAiProviderSettingsStorage,
  QuireAiPersistedModelProfile,
  QuireAiPersistedProviderSettings,
  QuireAiProviderSettingsDraft
} from "./types";
import { validateQuireAiProviderSettings } from "./validate";

const publicSettingsKey = "quirekit.ai.pi-provider-settings.v4";
const persistentSecretsKey = "quirekit.ai.pi-provider-api-keys.local.v4";

/**
 * Loads a validated local provider draft without exposing malformed storage.
 *
 * @param storage - Browser storage authorities.
 * @param defaultHostUrl - Application fallback Host URL.
 * @returns Editable settings draft and whether an explicit document existed.
 */
export function loadQuireAiProviderSettings(
  storage: QuireAiProviderSettingsStorage,
  defaultHostUrl: string
): {
  readonly draft: QuireAiProviderSettingsDraft;
  readonly configured: boolean;
} {
  const raw = safeRead(storage.local, publicSettingsKey);
  const persisted = parsePersistedSettings(raw);
  if (persisted === undefined) {
    return { configured: false, draft: createDefaultDraft(defaultHostUrl) };
  }
  const localSecrets = parseSecretMap(
    safeRead(storage.local, persistentSecretsKey)
  );
  const draft: QuireAiProviderSettingsDraft = {
    mode: persisted.mode,
    defaultProfileId: persisted.defaultProfileId,
    hostUrl: persisted.hostUrl,
    profiles: persisted.profiles.map(profile => ({
      ...profile,
      apiKey: localSecrets[profile.id] ?? ""
    }))
  };
  try {
    return { configured: true, draft: validateQuireAiProviderSettings(draft) };
  } catch {
    return { configured: false, draft: createDefaultDraft(defaultHostUrl) };
  }
}

/**
 * Persists public settings separately from every browser credential.
 *
 * @param storage - Browser storage authorities.
 * @param draft - Validated settings selected by the user.
 */
export function saveQuireAiProviderSettings(
  storage: QuireAiProviderSettingsStorage,
  draft: QuireAiProviderSettingsDraft
): void {
  const validated = validateQuireAiProviderSettings(draft);
  const persisted: QuireAiPersistedProviderSettings = {
    version: 4,
    mode: validated.mode,
    profiles: validated.profiles.map(stripProfileSecret),
    defaultProfileId: validated.defaultProfileId,
    hostUrl: validated.hostUrl
  };
  const localSecrets: Record<string, string> = {};
  for (const profile of validated.profiles) {
    if (profile.apiKey.length === 0) continue;
    localSecrets[profile.id] = profile.apiKey;
  }
  storage.local.setItem(publicSettingsKey, JSON.stringify(persisted));
  writeSecretMap(storage.local, persistentSecretsKey, localSecrets);
}

/**
 * Removes every local provider setting and credential.
 *
 * @param storage - Browser storage authorities.
 */
export function clearQuireAiProviderSettings(
  storage: QuireAiProviderSettingsStorage
): void {
  storage.local.removeItem(publicSettingsKey);
  storage.local.removeItem(persistentSecretsKey);
}

/**
 * Creates the initial DeepSeek, Qwen, and MiMo profile catalog.
 *
 * @param defaultHostUrl - Application fallback Host URL.
 * @returns Default multi-model browser-direct settings.
 */
function createDefaultDraft(defaultHostUrl: string): QuireAiProviderSettingsDraft {
  const profiles = quireAiProviderPresets
    .filter(preset => preset.id === "deepseek"
      || preset.id === "qwen"
      || preset.id === "mimo")
    .map(preset => createQuireAiProfileFromPreset(preset));
  return {
    mode: "browser",
    profiles,
    defaultProfileId: "profile-deepseek",
    hostUrl: defaultHostUrl
  };
}

/**
 * Removes one credential from its public profile representation.
 *
 * @param profile - Validated editable profile.
 * @returns Persistable non-secret profile.
 */
function stripProfileSecret(
  profile: QuireAiBrowserModelDraft
): QuireAiPersistedModelProfile {
  const { apiKey: _apiKey, ...persisted } = profile;
  return persisted;
}

/**
 * Parses the closed Pi-native version-four storage format.
 *
 * @param value - Raw storage value.
 * @returns Valid settings or undefined.
 */
function parsePersistedSettings(
  value: string | null
): QuireAiPersistedProviderSettings | undefined {
  const candidate = parseRecord(value);
  if (candidate?.version !== 4
    || !isConnectionMode(candidate.mode)
    || typeof candidate.defaultProfileId !== "string"
    || typeof candidate.hostUrl !== "string"
    || !Array.isArray(candidate.profiles)) return undefined;
  const profiles = candidate.profiles
    .map(parsePersistedProfile)
    .filter((profile): profile is QuireAiPersistedModelProfile => profile !== undefined);
  if (profiles.length !== candidate.profiles.length || profiles.length === 0) {
    return undefined;
  }
  return {
    version: 4,
    mode: candidate.mode,
    profiles,
    defaultProfileId: candidate.defaultProfileId,
    hostUrl: candidate.hostUrl
  };
}

/**
 * Parses one non-secret profile from persisted JSON.
 *
 * @param value - Unknown profile value.
 * @returns Closed profile or undefined.
 */
function parsePersistedProfile(
  value: unknown
): QuireAiPersistedModelProfile | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const profile = value as Record<string, unknown>;
  if (typeof profile.id !== "string"
    || !isProtocol(profile.protocol)
    || typeof profile.baseUrl !== "string"
    || !isAuthScheme(profile.authScheme)
    || typeof profile.model !== "string"
    || typeof profile.providerLabel !== "string"
    || !Number.isInteger(profile.maxOutputTokens)
    || !Number.isInteger(profile.contextWindowTokens)
    || !Number.isInteger(profile.contextBudgetPercent)
    || !isThinkingLevel(profile.thinkingLevel)) return undefined;
  return {
    id: profile.id,
    protocol: profile.protocol,
    baseUrl: profile.baseUrl,
    authScheme: profile.authScheme,
    model: profile.model,
    providerLabel: profile.providerLabel,
    maxOutputTokens: profile.maxOutputTokens as number,
    contextWindowTokens: profile.contextWindowTokens as number,
    contextBudgetPercent: profile.contextBudgetPercent as number,
    thinkingLevel: profile.thinkingLevel
  };
}

/** @param value - Candidate connection mode. @returns Whether it is admitted. */
function isConnectionMode(value: unknown): value is QuireAiProviderSettingsDraft["mode"] {
  return value === "browser" || value === "host" || value === "local";
}

/** @param value - Candidate API protocol. @returns Whether it is admitted. */
function isProtocol(
  value: unknown
): value is QuireAiBrowserModelDraft["protocol"] {
  return value === "openai-completions"
    || value === "openai-responses"
    || value === "anthropic-messages";
}

/** @param value - Candidate credential scheme. @returns Whether it is admitted. */
function isAuthScheme(
  value: unknown
): value is QuireAiBrowserModelDraft["authScheme"] {
  return value === "bearer" || value === "x-api-key" || value === "api-key";
}

/** @param value - Candidate Pi thinking level. @returns Whether it is admitted. */
function isThinkingLevel(
  value: unknown
): value is QuireAiBrowserModelDraft["thinkingLevel"] {
  return value === "high" || value === "max" || value === "off";
}

/**
 * Parses a bounded credential map.
 *
 * @param value - Raw secret map JSON.
 * @returns Safe profile-keyed credential map.
 */
function parseSecretMap(value: string | null): Readonly<Record<string, string>> {
  const candidate = parseRecord(value);
  if (candidate?.version !== 1
    || candidate.values === null
    || typeof candidate.values !== "object"
    || Array.isArray(candidate.values)) return {};
  const values: Record<string, string> = {};
  for (const [key, secret] of Object.entries(candidate.values)) {
    if (key.length <= 160 && typeof secret === "string" && secret.length <= 8_192) {
      values[key] = secret;
    }
  }
  return values;
}

/**
 * Writes or removes one profile-keyed credential document.
 *
 * @param storage - Secret storage authority.
 * @param key - Owned storage key.
 * @param values - Credentials grouped by profile id.
 */
function writeSecretMap(
  storage: Storage,
  key: string,
  values: Readonly<Record<string, string>>
): void {
  if (Object.keys(values).length === 0) storage.removeItem(key);
  else storage.setItem(key, JSON.stringify({ version: 1, values }));
}

/**
 * Parses one raw JSON object.
 *
 * @param value - Raw JSON text.
 * @returns Plain object or undefined.
 */
function parseRecord(value: string | null): Record<string, unknown> | undefined {
  if (value === null) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads optional storage while tolerating disabled browser persistence.
 *
 * @param storage - Browser storage authority.
 * @param key - Exact owned key.
 * @returns Stored value or null.
 */
function safeRead(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

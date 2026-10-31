import type {
  QuireAiBrowserModelDraft,
  QuireAiProviderSettingsDraft
} from "./types";

/**
 * Validates and normalizes one user-authored provider settings draft.
 *
 * @param draft - Untrusted form values.
 * @returns Closed normalized settings.
 */
export function validateQuireAiProviderSettings(
  draft: QuireAiProviderSettingsDraft
): QuireAiProviderSettingsDraft {
  if (draft.mode !== "browser" && draft.mode !== "host" && draft.mode !== "local") {
    throw new TypeError("The provider connection mode is invalid.");
  }
  const hostUrl = normalizeHttpUrl(draft.hostUrl, "Host URL", true);
  if (draft.mode === "host" && hostUrl.length === 0) {
    throw new TypeError("Host URL is required for Host mode.");
  }
  if (!Array.isArray(draft.profiles) || draft.profiles.length === 0) {
    throw new TypeError("At least one browser-direct model profile is required.");
  }
  if (draft.profiles.length > 32) {
    throw new TypeError("At most 32 browser-direct model profiles are supported.");
  }
  const ids = new Set<string>();
  const profiles = draft.profiles.map((profile, index) => {
    const validated = validateProfile(profile, index + 1);
    if (ids.has(validated.id)) {
      throw new TypeError(`Model profile id ${validated.id} is duplicated.`);
    }
    ids.add(validated.id);
    return validated;
  });
  const defaultProfileId = requireBoundedText(
    draft.defaultProfileId,
    "Default profile",
    160
  );
  if (!ids.has(defaultProfileId)) {
    throw new TypeError("The default model profile is unavailable.");
  }
  return Object.freeze({
    mode: draft.mode,
    profiles: Object.freeze(profiles),
    defaultProfileId,
    hostUrl
  });
}

/**
 * Validates one browser-direct model profile.
 *
 * @param profile - Untrusted editable model profile.
 * @param position - One-based profile position used in diagnostics.
 * @returns Closed normalized profile.
 */
function validateProfile(
  profile: QuireAiBrowserModelDraft,
  position: number
): QuireAiBrowserModelDraft {
  const label = `Model profile ${position}`;
  const id = requireBoundedText(profile.id, `${label} id`, 160);
  const baseUrl = normalizeHttpUrl(profile.baseUrl, `${label} API Base URL`);
  const model = requireBoundedText(profile.model, `${label} model ID`, 160);
  const providerLabel = requireBoundedText(
    profile.providerLabel,
    `${label} provider label`,
    80
  );
  if (profile.protocol !== "openai-completions"
    && profile.protocol !== "openai-responses"
    && profile.protocol !== "anthropic-messages") {
    throw new TypeError(`${label} protocol is invalid.`);
  }
  if (profile.authScheme !== "bearer"
    && profile.authScheme !== "x-api-key"
    && profile.authScheme !== "api-key") {
    throw new TypeError(`${label} authentication mode is invalid.`);
  }
  if (profile.thinkingLevel !== "high"
    && profile.thinkingLevel !== "max"
    && profile.thinkingLevel !== "off") {
    throw new TypeError(`${label} Pi thinking level is invalid.`);
  }
  assertIntegerRange(
    profile.maxOutputTokens,
    1_024,
    262_144,
    `${label} max output tokens`
  );
  assertIntegerRange(
    profile.contextWindowTokens,
    8_192,
    2_000_000,
    `${label} context window`
  );
  assertIntegerRange(
    profile.contextBudgetPercent,
    40,
    90,
    `${label} context utilization`
  );
  if (profile.maxOutputTokens >= profile.contextWindowTokens) {
    throw new TypeError(`${label} max output tokens must leave room inside the context window.`);
  }
  return Object.freeze({
    id,
    protocol: profile.protocol,
    baseUrl,
    authScheme: profile.authScheme,
    apiKey: profile.apiKey.trim(),
    model,
    providerLabel,
    maxOutputTokens: profile.maxOutputTokens,
    contextWindowTokens: profile.contextWindowTokens,
    contextBudgetPercent: profile.contextBudgetPercent,
    thinkingLevel: profile.thinkingLevel
  });
}

/**
 * Normalizes a safe HTTP(S) endpoint without embedded credentials.
 *
 * @param value - Candidate URL.
 * @param label - Human-readable field label.
 * @param allowEmpty - Whether an empty inactive field is admitted.
 * @returns Normalized URL or an empty string.
 */
function normalizeHttpUrl(
  value: string,
  label: string,
  allowEmpty = false
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 && allowEmpty) return "";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new TypeError(`${label} must be a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TypeError(`${label} must use HTTP or HTTPS.`);
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new TypeError(`${label} must not contain credentials.`);
  }
  parsed.hash = "";
  return parsed.toString();
}

/**
 * Requires one bounded non-empty configuration label.
 *
 * @param value - Candidate text.
 * @param label - Human-readable field label.
 * @param maximumLength - Maximum admitted length.
 * @returns Trimmed text.
 */
function requireBoundedText(
  value: string,
  label: string,
  maximumLength: number
): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new TypeError(
      `${label} is required and must be at most ${maximumLength} characters.`
    );
  }
  return normalized;
}

/**
 * Validates one bounded integer.
 *
 * @param value - Candidate numeric field.
 * @param minimum - Inclusive minimum.
 * @param maximum - Inclusive maximum.
 * @param label - Human-readable diagnostic label.
 */
function assertIntegerRange(
  value: number,
  minimum: number,
  maximum: number,
  label: string
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(
      `${label} must be an integer from ${minimum} to ${maximum}.`
    );
  }
}

import type { QuireAiHostUrlSources } from "./types";

/** Query parameter used to override the AI Host at runtime. */
export const quireAiHostUrlQueryParameter = "aiHostUrl";

/**
 * Resolves the AI Host without embedding provider or credential configuration.
 *
 * An explicit query parameter wins over the build-time and same-origin
 * defaults. Passing an empty query value intentionally disables the Host for
 * that browser URL.
 *
 * @param sources - Browser query string and optional build-time fallback.
 * @returns Trimmed Host URL, or undefined when the optional Host is disabled.
 */
export function resolveQuireAiHostUrl(
  sources: QuireAiHostUrlSources
): string | undefined {
  const parameters = new URLSearchParams(sources.search);
  if (parameters.has(quireAiHostUrlQueryParameter)) {
    return normalizeHostUrl(parameters.get(quireAiHostUrlQueryParameter));
  }
  return normalizeHostUrl(sources.environmentHostUrl)
    ?? normalizeHostUrl(sources.defaultHostUrl);
}

/**
 * Normalizes an optional Host URL without interpreting provider details.
 *
 * @param value - Untrusted query or environment value.
 * @returns Trimmed non-empty URL, or undefined.
 */
function normalizeHostUrl(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0
    ? undefined
    : normalized;
}

import type {
  QuireAiPiHostCatalog,
  QuireAiPiHostCatalogOptions,
  QuireAiPiHostProfile,
  QuireAiPiHostProfileCapabilities
} from "../types";
import {
  resolveQuireAiPiHostEndpoint,
  resolveQuireAiPiHostFetch
} from "./endpoint";

/**
 * Loads and validates sanitized profiles from the optional Pi Provider Host.
 *
 * @param options - Host URL, fetch, headers, and cancellation signal.
 * @returns Immutable safe profile catalog.
 */
export async function loadQuireAiPiHostCatalog(
  options: QuireAiPiHostCatalogOptions
): Promise<QuireAiPiHostCatalog> {
  const endpoint = resolveQuireAiPiHostEndpoint(options.hostUrl, "profiles");
  const fetchImplementation = resolveQuireAiPiHostFetch(options.fetch);
  const response = await fetchImplementation(endpoint, {
    method: "GET",
    headers: new Headers(await options.getHeaders?.()),
    ...(options.signal === undefined ? {} : { signal: options.signal })
  });
  if (!response.ok) {
    throw new TypeError(`The Pi Provider Host returned HTTP ${response.status}.`);
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw invalidCatalog();
  }
  return parseCatalog(value);
}

/**
 * Parses one complete Host profile catalog.
 *
 * @param value - Unknown catalog payload.
 * @returns Validated catalog.
 */
function parseCatalog(value: unknown): QuireAiPiHostCatalog {
  if (!isRecord(value) || value.version !== 1) throw invalidCatalog();
  const defaultProfileId = readRequiredString(value.defaultProfileId);
  if (!Array.isArray(value.profiles) || value.profiles.length === 0) {
    throw invalidCatalog();
  }
  const profiles = value.profiles.map(parseProfile);
  const ids = new Set(profiles.map(profile => profile.id));
  if (ids.size !== profiles.length || !ids.has(defaultProfileId)) {
    throw invalidCatalog();
  }
  return Object.freeze({
    version: 1,
    defaultProfileId,
    profiles: Object.freeze(profiles)
  });
}

/**
 * Parses one sanitized Host profile.
 *
 * @param value - Unknown profile payload.
 * @returns Validated safe profile.
 */
function parseProfile(value: unknown): QuireAiPiHostProfile {
  if (!isRecord(value) || !isRecord(value.capabilities)) throw invalidCatalog();
  const contextWindowTokens = readOptionalBudget(value.contextWindowTokens, 2_000_000);
  const maxOutputTokens = readOptionalBudget(value.maxOutputTokens, 262_144);
  return Object.freeze({
    id: readRequiredString(value.id),
    label: readRequiredString(value.label),
    provider: readRequiredString(value.provider),
    model: readRequiredString(value.model),
    ...(contextWindowTokens === undefined ? {} : { contextWindowTokens }),
    ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
    capabilities: parseCapabilities(value.capabilities)
  });
}

/**
 * Parses known boolean capability flags only.
 *
 * @param value - Capability record.
 * @returns Known flags.
 */
function parseCapabilities(
  value: Readonly<Record<string, unknown>>
): QuireAiPiHostProfileCapabilities {
  for (const key of ["vision", "files", "reasoning"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      throw invalidCatalog();
    }
  }
  return Object.freeze({
    ...(value.vision === undefined ? {} : { vision: value.vision as boolean }),
    ...(value.files === undefined ? {} : { files: value.files as boolean }),
    ...(value.reasoning === undefined ? {} : { reasoning: value.reasoning as boolean })
  });
}

/**
 * Reads one trimmed required text field.
 *
 * @param value - Unknown field.
 * @returns Trimmed text.
 */
function readRequiredString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw invalidCatalog();
  return value.trim();
}

/**
 * Reads one optional bounded integer budget.
 *
 * @param value - Unknown budget.
 * @param maximum - Maximum admitted value.
 * @returns Budget or undefined.
 */
function readOptionalBudget(value: unknown, maximum: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > maximum) {
    throw invalidCatalog();
  }
  return value as number;
}

/**
 * Checks whether record properties can be read.
 *
 * @param value - Unknown value.
 * @returns Whether value is a record.
 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Creates the stable invalid-catalog failure.
 *
 * @returns Catalog error.
 */
function invalidCatalog(): TypeError {
  return new TypeError("The Pi Provider Host returned an invalid profile catalog.");
}

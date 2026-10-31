import { verifyQuireKitLicenseKey } from "../key/verify";
import type { QuireKitLicenseCheck, QuireKitProduct } from "../types";
import { currentLocation, isDevelopmentLocation, releaseDate } from "./environment";
import { reportEvaluation } from "./notice";

/** Page-wide license state shared by every copy of this package loaded on the page; it holds no verification results. */
interface LicenseState {
  /** Key set by the host. */ key: string | undefined;
  /** Key-change listeners. */ readonly listeners: Set<() => void>;
  /** Latest release date declared for each product line. */ readonly releaseDates: Map<QuireKitProduct, string>;
}

const stateKey = Symbol.for("quirekit.license.state.v1");

/**
 * Returns the page-wide state, creating it once; duplicated installs share one key.
 * @returns Shared mutable state.
 */
function state(): LicenseState {
  const scope = globalThis as unknown as Record<symbol, LicenseState | undefined>;
  return scope[stateKey] ??= { key: undefined, listeners: new Set(), releaseDates: new Map() };
}

/**
 * Verification results of this copy only, keyed by product, key and release date. Keeping them
 * out of the shared state means rewriting a global object cannot fake a licensed result.
 */
const checks = new Map<string, Promise<QuireKitLicenseCheck>>();

/**
 * Sets or clears the license key for every QuireKit commercial component on the page.
 * @param key - Issued key, `open-source`, or null to clear.
 */
export function setQuireKitLicense(key: string | null): void {
  const shared = state(), next = key?.trim() || undefined;
  if (next === shared.key) return;
  shared.key = next;
  for (const listener of shared.listeners) listener();
}

/**
 * Records the release date of a package belonging to a product line; the newest date of
 * a product line is the one its key's update window must cover.
 * @param product - Product line.
 * @param date - Release date, `YYYY-MM-DD`.
 */
export function recordReleaseDate(product: QuireKitProduct, date: string): void {
  const shared = state(), current = shared.releaseDates.get(product);
  if (current !== undefined && current >= date) return;
  shared.releaseDates.set(product, date);
}

/**
 * Checks one product line, verifying the key at most once until it changes.
 * @param product - Product line requesting the check.
 * @returns Licensed, evaluation or invalid result.
 */
export function checkQuireKitLicense(product: QuireKitProduct): Promise<QuireKitLicenseCheck> {
  const shared = state(), release = shared.releaseDates.get(product) ?? releaseDate();
  const cacheKey = `${product}\n${shared.key ?? ""}\n${release ?? ""}`, cached = checks.get(cacheKey);
  if (cached) return cached;
  const location = currentLocation();
  const check = isDevelopmentLocation(location)
    ? Promise.resolve<QuireKitLicenseCheck>({ status: "licensed" })
    : verifyQuireKitLicenseKey(shared.key, { product, hostname: location?.hostname, releaseDate: release });
  const reported = check.then((result) => {
    if (result.status !== "licensed") reportEvaluation(product, result);
    return result;
  });
  checks.set(cacheKey, reported);
  return reported;
}

/**
 * Subscribes to key changes so mounted notices can recheck.
 * @param listener - Called after every effective key change.
 * @returns Unsubscribe function.
 */
export function subscribeQuireKitLicense(listener: () => void): () => void {
  const shared = state();
  shared.listeners.add(listener);
  return () => { shared.listeners.delete(listener); };
}

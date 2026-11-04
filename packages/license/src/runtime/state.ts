import { verifyQuireKitLicenseKey } from "../key/verify";
import type { QuireKitLicenseCheck, QuireKitOemDeclaration, QuireKitProduct } from "../types";
import { currentLocation, isDevelopmentLocation, releaseDate } from "./environment";
import { reportEvaluation } from "./notice";

/** Page-wide license state shared by every copy of this package loaded on the page; it holds no verification results. */
interface LicenseState {
  /** Key set by the host. */ key: string | undefined;
  /** Key-change listeners. */ readonly listeners: Set<() => void>;
  /** Latest release date declared for each product line. */ readonly releaseDates: Map<QuireKitProduct, string>;
  /** OEM certificate and product name declared by the host product; absent unless a vendor ships one. */ oem?: QuireKitOemDeclaration | undefined;
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
 * @param key - Issued key, or null to clear.
 */
export function setQuireKitLicense(key: string | null): void {
  const shared = state(), next = key?.trim() || undefined;
  if (next === shared.key) return;
  shared.key = next;
  for (const listener of shared.listeners) listener();
}

/**
 * Declares the OEM certificate a vendor product ships, so sub-licenses its customers configure
 * with `setQuireKitLicense` verify against it. Vendors call this in their product code.
 * @param certificate - Certificate issued by QuireKit, or null to clear.
 * @param options - Vendor product name, as written in the certificate.
 */
export function setQuireKitOemCertificate(certificate: string | null, options?: { readonly application: string }): void {
  const shared = state();
  const next = certificate?.trim() ? { certificate: certificate.trim(), application: options?.application ?? "" } : undefined;
  if (next?.certificate === shared.oem?.certificate && next?.application === shared.oem?.application) return;
  shared.oem = next;
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
  const location = currentLocation(), development = isDevelopmentLocation(location);
  const oem = shared.oem;
  const cacheKey = [product, shared.key ?? "", release ?? "", development, oem?.certificate ?? "", oem?.application ?? ""].join("\n");
  const cached = checks.get(cacheKey);
  if (cached) return cached;
  const check = development
    ? Promise.resolve<QuireKitLicenseCheck>({ status: "licensed" })
    : verifyQuireKitLicenseKey(shared.key, {
      product, hostname: location?.hostname, releaseDate: release, certificate: oem?.certificate, application: oem?.application
    });
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

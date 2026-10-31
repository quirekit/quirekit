import type { QuireKitLicenseCheck, QuireKitLicenseContext, QuireKitProduct } from "../types";
import { decodeBase64url, parseLicenseKey } from "./codec";
import { quireKitIssuerPublicKey, revokedLicenseIds } from "./public-key";

/** Product lines each licensed product also covers: the professional tier includes the standard one, Classic the DOCX it uses internally, and MD the DOCX and PDF/OFD exports behind its Word and fixed-layout export. */
const includedProducts: Readonly<Record<QuireKitProduct, readonly QuireKitProduct[]>> = {
  "classic-pro": ["classic", "docx"],
  classic: ["docx"],
  export: [],
  md: ["docx", "export"],
  docx: []
};

/** Self-declared value for OSI-licensed open-source projects; governed by the license terms only. */
export const openSourceLicenseValue = "open-source";

/**
 * Verifies one key for one product. Pure apart from WebCrypto, so it runs the same in
 * browsers, workers and Node.
 * @param key - License key, or undefined when none was set.
 * @param context - Product and environment facts.
 * @returns Licensed, evaluation or invalid, with the reason.
 */
export async function verifyQuireKitLicenseKey(key: string | undefined, context: QuireKitLicenseContext): Promise<QuireKitLicenseCheck> {
  if (key === undefined || key.trim() === "") return { status: "evaluation", reason: "missing" };
  if (key.trim() === openSourceLicenseValue) return { status: "licensed", plan: "open-source" };
  const parsed = parseLicenseKey(key);
  if (!parsed) return { status: "invalid", reason: "malformed" };
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { status: "invalid", reason: "unsupported" };
  let valid: boolean;
  try {
    const raw = context.publicKey ?? decodeBase64url(quireKitIssuerPublicKey)!;
    const publicKey = await subtle.importKey("raw", raw as Uint8Array<ArrayBuffer>, { name: "Ed25519" }, false, ["verify"]);
    valid = await subtle.verify({ name: "Ed25519" }, publicKey, parsed.signature as Uint8Array<ArrayBuffer>, parsed.body as Uint8Array<ArrayBuffer>);
  } catch {
    return { status: "invalid", reason: "unsupported" };
  }
  if (!valid) return { status: "invalid", reason: "signature" };

  // Entitlement checks run only on a verified payload.
  const { payload } = parsed;
  if ((context.revoked ?? revokedLicenseIds).has(payload.id)) return { status: "invalid", reason: "revoked" };
  if (!coversProduct(payload.products, context.product)) return { status: "invalid", reason: "product" };
  // A domain-bound key never applies where the host is unknown (Node, SSR, workers without a
  // location), so a key copied from a public site cannot license headless or server use.
  if (payload.domains && (context.hostname === undefined || !payload.domains.some((domain) => hostMatches(domain, context.hostname!)))) {
    return { status: "invalid", reason: "domain" };
  }
  if (context.releaseDate !== undefined && context.releaseDate > payload.updatesUntil) return { status: "invalid", reason: "updates-expired" };
  return { status: "licensed", plan: payload.plan, licensee: payload.licensee };
}

/**
 * Reports whether licensed products cover one product, directly or through inclusion.
 * @param licensed - Products named by the key.
 * @param product - Product being checked.
 * @returns Whether the product is covered.
 */
export function coversProduct(licensed: readonly (QuireKitProduct | "*")[], product: QuireKitProduct): boolean {
  return licensed.some((item) => item === "*" || item === product || includedProducts[item].includes(product));
}

/**
 * Matches a licensed domain pattern against a host name.
 * @param pattern - `example.com` or `*.example.com`.
 * @param hostname - Current host name.
 * @returns Whether the host is covered; a wildcard also covers the bare domain.
 */
export function hostMatches(pattern: string, hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/u, ""), domain = pattern.toLowerCase().replace(/\.$/u, "");
  if (!domain.startsWith("*.")) return host === domain;
  const base = domain.slice(2);
  return host === base || host.endsWith(`.${base}`);
}

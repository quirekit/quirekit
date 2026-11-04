import { ipv4BlockPrefix, isIpv4 } from "./address";
import type { QuireKitLicenseContext, QuireKitLicenseReason, QuireKitProduct } from "../types";

/** Product lines each licensed product also covers: the professional tier includes the standard one, Classic the DOCX it uses internally, and MD the DOCX and PDF/OFD exports behind its Word and fixed-layout export. */
const includedProducts: Readonly<Record<QuireKitProduct, readonly QuireKitProduct[]>> = {
  "classic-pro": ["classic", "docx"],
  classic: ["docx"],
  export: [],
  md: ["docx", "export"],
  docx: []
};

/** Entitlement facts of a verified key or certificate chain. */
export interface Entitlement {
  /** Covered product lines. */ readonly products: readonly (QuireKitProduct | "*")[];
  /** Optional host names. */ readonly domains?: readonly string[] | undefined;
  /** Last covered release date. */ readonly updatesUntil: string;
}

/**
 * Checks product, domain and update-window entitlement of a verified payload.
 * @param entitlement - Verified entitlement facts.
 * @param context - Product and environment facts.
 * @returns Why the entitlement does not apply, or undefined when it does.
 */
export function entitlementFailure(entitlement: Entitlement, context: QuireKitLicenseContext): QuireKitLicenseReason | undefined {
  if (!coversProduct(entitlement.products, context.product)) return "product";
  // A domain-bound key never applies where the host is unknown (Node, SSR, workers without a
  // location), so a key copied from a public site cannot license headless or server use.
  const { domains } = entitlement;
  if (domains && (context.hostname === undefined || !domains.some((domain) => hostMatches(domain, context.hostname!)))) return "domain";
  if (context.releaseDate !== undefined && context.releaseDate > entitlement.updatesUntil) return "updates-expired";
  return undefined;
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
 * @param pattern - `example.com`, `*.example.com`, an IPv4 address or a `/24` block such as `192.168.10.*`.
 * @param hostname - Current host name.
 * @returns Whether the host is covered; a wildcard also covers the bare domain.
 */
export function hostMatches(pattern: string, hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/u, ""), domain = pattern.toLowerCase().replace(/\.$/u, "");
  const block = ipv4BlockPrefix(domain);
  if (block !== undefined) return isIpv4(host) && host.startsWith(block);
  if (!domain.startsWith("*.")) return host === domain;
  const base = domain.slice(2);
  return host === base || host.endsWith(`.${base}`);
}

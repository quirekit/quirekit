import type { QuireKitLicenseCheck, QuireKitLicenseContext } from "../../types";
import { decodeBase64url } from "../codec";
import { entitlementFailure } from "../entitlement";
import { quireKitIssuerPublicKey, revokedLicenseIds } from "../public-key";
import { verifyOemChain } from "./chain";
import { parseSubLicense } from "./codec";

/**
 * Verifies a vendor sub-license through the OEM certificate its host product ships. The
 * certificate carries the product lines, update window and vendor key; the sub-license only
 * names the end customer and optional domains, so renewing the certificate never reissues it.
 * @param key - Sub-license configured by the deployment.
 * @param context - Product, environment, certificate and declared application.
 * @returns Licensed, evaluation or invalid, with the reason.
 */
export async function verifySubLicense(key: string, context: QuireKitLicenseContext): Promise<QuireKitLicenseCheck> {
  if (context.certificate === undefined) return { status: "invalid", reason: parseSubLicense(key) ? "certificate" : "malformed" };
  const chain = await verifyOemChain(key, context.certificate, context.publicKey ?? decodeBase64url(quireKitIssuerPublicKey)!);
  if (!chain.ok) return { status: "invalid", reason: chain.reason };

  // The chain holds; the certificate must still be in force and limited to the declared product.
  const { certificate: cert, subLicense: sub } = chain, revoked = context.revoked ?? revokedLicenseIds;
  if (revoked.has(cert.id) || revoked.has(sub.id)) return { status: "invalid", reason: "revoked" };
  if (normalizeApplication(context.application) !== normalizeApplication(cert.application)) return { status: "invalid", reason: "application" };

  // Products and update window come from the certificate, domains from the sub-license.
  const failure = entitlementFailure({ products: cert.products, domains: sub.domains, updatesUntil: cert.updatesUntil }, context);
  if (failure) return { status: "invalid", reason: failure };
  return {
    status: "licensed", plan: "oem", licensee: sub.licensee, id: sub.id,
    updatesUntil: cert.updatesUntil, vendor: cert.vendor, application: cert.application
  };
}

/**
 * Normalizes a product name for comparison.
 * @param name - Declared or certified product name.
 * @returns Trimmed lower-case name, or undefined when absent.
 */
function normalizeApplication(name: string | undefined): string | undefined {
  const trimmed = name?.trim().toLowerCase();
  return trimmed === "" ? undefined : trimmed;
}

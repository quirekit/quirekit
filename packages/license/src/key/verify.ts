import type { QuireKitLicenseCheck, QuireKitLicenseContext } from "../types";
import { decodeBase64url, parseLicenseKey, quireKitSubLicensePrefix } from "./codec";
import { entitlementFailure } from "./entitlement";
import { verifySubLicense } from "./oem/verify";
import { quireKitIssuerPublicKey, revokedLicenseIds } from "./public-key";
import { verifySignature } from "./signature";

/**
 * Verifies one key for one product. Pure apart from WebCrypto, so it runs the same in
 * browsers, workers and Node.
 * @param key - License key or OEM sub-license, or undefined when none was set.
 * @param context - Product and environment facts.
 * @returns Licensed, evaluation or invalid, with the reason.
 */
export async function verifyQuireKitLicenseKey(key: string | undefined, context: QuireKitLicenseContext): Promise<QuireKitLicenseCheck> {
  if (key === undefined || key.trim() === "") return { status: "evaluation", reason: "missing" };
  if (key.trim().startsWith(quireKitSubLicensePrefix)) return verifySubLicense(key, context);
  const parsed = parseLicenseKey(key);
  if (!parsed) return { status: "invalid", reason: "malformed" };
  const valid = await verifySignature(context.publicKey ?? decodeBase64url(quireKitIssuerPublicKey)!, parsed);
  if (valid === "unsupported") return { status: "invalid", reason: "unsupported" };
  if (!valid) return { status: "invalid", reason: "signature" };

  // Entitlement checks run only on a verified payload.
  const { payload } = parsed;
  if ((context.revoked ?? revokedLicenseIds).has(payload.id)) return { status: "invalid", reason: "revoked" };
  const failure = entitlementFailure(payload, context);
  if (failure) return { status: "invalid", reason: failure };
  return { status: "licensed", plan: payload.plan, licensee: payload.licensee, id: payload.id, updatesUntil: payload.updatesUntil };
}

import { decodeBase64url } from "../key/codec";
import { verifyOemChain } from "../key/oem/chain";
import type { QuireKitSubLicenseChainResult } from "../types";
import { quireKitIssuerPublicKey } from "../key/public-key";

/**
 * Checks that a sub-license was signed under a QuireKit-issued certificate by the same vendor,
 * as issuance systems do before recording it. Revocation and entitlement are not checked.
 * @param subLicense - Vendor sub-license.
 * @param certificate - OEM certificate.
 * @param issuerPublicKey - QuireKit public key, raw and base64url; defaults to the built-in key.
 * @returns Both payloads, or why the chain does not hold.
 */
export function verifyQuireKitSubLicenseChain(subLicense: string, certificate: string, issuerPublicKey = quireKitIssuerPublicKey): Promise<QuireKitSubLicenseChainResult> {
  const key = decodeBase64url(issuerPublicKey);
  if (!key || key.length !== 32) return Promise.resolve({ ok: false, reason: "certificate" });
  return verifyOemChain(subLicense, certificate, key);
}

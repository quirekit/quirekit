import type { QuireKitSubLicenseChainResult } from "../../types";
import { isOfflineBinding } from "../address";
import { decodeBase64url } from "../codec";
import { verifySignature } from "../signature";
import { parseOemCertificate, parseSubLicense } from "./codec";

/**
 * Checks that a certificate is issued by QuireKit and that a sub-license is signed by one of the
 * vendor keys it lists for the same vendor, no later than the certificate's update window, and
 * either countersigned by the console or bound as an offline certificate allows. Revocation,
 * product, domain and update window are left to the caller.
 * @param subLicense - Vendor sub-license.
 * @param certificate - OEM certificate.
 * @param issuerKey - Raw QuireKit Ed25519 public key.
 * @returns Both payloads, or why the chain does not hold.
 */
export async function verifyOemChain(subLicense: string, certificate: string, issuerKey: Uint8Array): Promise<QuireKitSubLicenseChainResult> {
  const sub = parseSubLicense(subLicense);
  if (!sub) return { ok: false, reason: "malformed" };
  const cert = parseOemCertificate(certificate);
  if (!cert) return { ok: false, reason: "certificate" };

  // Phase 1: the certificate must carry the QuireKit signature.
  const issued = await verifySignature(issuerKey, cert);
  if (issued === "unsupported") return { ok: false, reason: "unsupported" };
  if (!issued) return { ok: false, reason: "certificate" };

  // Phase 2: the sub-license must be signed by one of the vendor keys the certificate lists.
  const vendorKeys = cert.payload.publicKeys.map((text) => decodeBase64url(text));
  if (vendorKeys.some((bytes) => !bytes || bytes.length !== 32)) return { ok: false, reason: "certificate" };
  let signed: boolean | "unsupported" = false;
  for (const vendorKey of vendorKeys) {
    signed = await verifySignature(vendorKey!, sub);
    if (signed !== false) break;
  }
  if (signed === "unsupported") return { ok: false, reason: "unsupported" };
  if (!signed) return { ok: false, reason: "signature" };
  if (sub.payload.vendorId !== cert.payload.vendorId) return { ok: false, reason: "vendor" };
  // A lapsed certificate stops new issuance: only a renewed certificate covers later sub-licenses.
  if (sub.payload.issuedAt > cert.payload.updatesUntil) return { ok: false, reason: "certificate-lapsed" };

  // Phase 3: the console countersignature proves the issue date; without it only an offline
  // certificate admits the sub-license, and then only bound to a few narrow addresses.
  if (sub.countersignature) {
    const countersignKey = cert.payload.countersignKey === undefined ? null : decodeBase64url(cert.payload.countersignKey);
    if (!countersignKey || countersignKey.length !== 32) return { ok: false, reason: "countersign" };
    const countersigned = await verifySignature(countersignKey, { ...sub, signature: sub.countersignature });
    if (countersigned === "unsupported") return { ok: false, reason: "unsupported" };
    if (!countersigned) return { ok: false, reason: "countersign" };
  } else if (cert.payload.offline !== true || !isOfflineBinding(sub.payload.domains)) {
    return { ok: false, reason: "countersign" };
  }
  return { ok: true, certificate: cert.payload, subLicense: sub.payload };
}

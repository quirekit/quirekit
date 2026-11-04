import type { QuireKitOemCertificatePayload, QuireKitSubLicensePayload } from "../../types";
import {
  decodeBase64url, isDomainList, isIsoDate, isProductList, parseSignedToken, quireKitOemCertificatePrefix, quireKitSubLicensePrefix,
  type ParsedSignedToken
} from "../codec";

/** A parsed sub-license with the optional console countersignature over the same signed bytes. */
export interface ParsedSubLicense extends ParsedSignedToken<QuireKitSubLicensePayload> {
  /** Countersignature added by the issuance console, absent on offline sub-licenses. */ readonly countersignature?: Uint8Array;
}

/**
 * Splits and validates the shape of an OEM certificate without checking its signature.
 * @param certificate - `qkc1_base64url(payload).base64url(signature)`.
 * @returns Parsed certificate, or null when malformed.
 */
export function parseOemCertificate(certificate: string): ParsedSignedToken<QuireKitOemCertificatePayload> | null {
  return parseSignedToken(certificate, quireKitOemCertificatePrefix, false, isCertificate);
}

/**
 * Splits and validates the shape of a vendor sub-license without checking its signatures.
 * @param key - `qks1_payload.vendorSignature`, optionally followed by `.countersignature`.
 * @returns Parsed sub-license, or null when malformed.
 */
export function parseSubLicense(key: string): ParsedSubLicense | null {
  const parts = key.trim().split(".");
  if (parts.length !== 2 && parts.length !== 3) return null;
  const parsed = parseSignedToken(parts.slice(0, 2).join("."), quireKitSubLicensePrefix, false, isSubLicense);
  if (!parsed || parts.length === 2) return parsed;
  const countersignature = decodeBase64url(parts[2]!);
  return countersignature?.length === 64 ? { ...parsed, countersignature } : null;
}

/**
 * Checks the certificate fields the verifier relies on.
 * @param value - Decoded JSON.
 * @returns Whether the value is a complete certificate payload.
 */
function isCertificate(value: unknown): value is QuireKitOemCertificatePayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return ["id", "vendor", "vendorId", "application"].every((field) => typeof record[field] === "string")
    && Array.isArray(record.publicKeys) && record.publicKeys.length > 0 && record.publicKeys.every((key) => typeof key === "string")
    && isProductList(record.products) && isIsoDate(record.issuedAt) && isIsoDate(record.updatesUntil)
    && (record.countersignKey === undefined || typeof record.countersignKey === "string")
    && (record.offline === undefined || typeof record.offline === "boolean");
}

/**
 * Checks the sub-license fields the verifier relies on.
 * @param value - Decoded JSON.
 * @returns Whether the value is a complete sub-license payload.
 */
function isSubLicense(value: unknown): value is QuireKitSubLicensePayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.vendorId === "string" && typeof record.licensee === "string"
    && isDomainList(record.domains) && isIsoDate(record.issuedAt);
}

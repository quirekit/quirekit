import type { QuireKitLicensePayload, QuireKitProduct } from "../types";

/** A signed token split into its signed bytes, signature and decoded payload. */
export interface ParsedSignedToken<T> {
  /** UTF-8 JSON bytes covered by the signature. */ readonly body: Uint8Array;
  /** Ed25519 signature bytes. */ readonly signature: Uint8Array;
  /** Decoded payload. */ readonly payload: T;
}

/** A license key split into its signed bytes and signature. */
export type ParsedLicenseKey = ParsedSignedToken<QuireKitLicensePayload>;

/** Prefix of issued keys, so leaked keys can be found by search; keys issued before it existed carry none. */
export const quireKitLicenseKeyPrefix = "qk1_";

/** Prefix of OEM certificates. */
export const quireKitOemCertificatePrefix = "qkc1_";

/** Prefix of sub-licenses signed by OEM vendors. */
export const quireKitSubLicensePrefix = "qks1_";

const plans = new Set(["community", "education", "nonprofit", "commercial", "enterprise", "open-source"]);
const products = new Set<string>(["classic", "classic-pro", "export", "md", "docx", "*"] satisfies (QuireKitProduct | "*")[]);
const isoDate = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Decodes unpadded base64url text.
 * @param text - base64url characters.
 * @returns Decoded bytes, or null for invalid text.
 */
export function decodeBase64url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/u.test(text)) return null;
  const padded = text.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Splits a signed token and decodes its JSON payload without checking the signature.
 * @param token - `prefix + base64url(payload).base64url(signature)`.
 * @param prefix - Token prefix.
 * @param optional - Whether the prefix may be absent, as on keys issued before it existed.
 * @param guard - Validates the decoded payload shape.
 * @returns Parsed token, or null when the token or payload shape is malformed.
 */
export function parseSignedToken<T>(token: string, prefix: string, optional: boolean, guard: (value: unknown) => value is T): ParsedSignedToken<T> | null {
  const trimmed = token.trim();
  if (!optional && !trimmed.startsWith(prefix)) return null;
  const parts = (trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed).split(".");
  if (parts.length !== 2) return null;
  const body = decodeBase64url(parts[0]!), signature = decodeBase64url(parts[1]!);
  if (!body || !signature || signature.length !== 64) return null;
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(body)); } catch { return null; }
  return guard(value) ? { body, signature, payload: value } : null;
}

/**
 * Splits and validates the shape of a license key without checking its signature.
 * @param key - `qk1_base64url(payload).base64url(signature)`; the prefix is optional.
 * @returns Parsed key, or null when the key or payload shape is malformed.
 */
export function parseLicenseKey(key: string): ParsedLicenseKey | null {
  return parseSignedToken(key, quireKitLicenseKeyPrefix, true, isPayload);
}

/**
 * Checks a product list.
 * @param value - Decoded field.
 * @returns Whether every item names a product line or `*`.
 */
export function isProductList(value: unknown): value is readonly (QuireKitProduct | "*")[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && products.has(item));
}

/**
 * Checks an optional domain list.
 * @param value - Decoded field.
 * @returns Whether the field is absent or a list of strings.
 */
export function isDomainList(value: unknown): value is readonly string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

/**
 * Checks a `YYYY-MM-DD` date field.
 * @param value - Decoded field.
 * @returns Whether the value is an ISO date string.
 */
export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && isoDate.test(value);
}

/**
 * Checks the payload fields the verifier relies on.
 * @param value - Decoded JSON.
 * @returns Whether the value is a complete payload.
 */
function isPayload(value: unknown): value is QuireKitLicensePayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.licensee === "string"
    && (record.application === undefined || typeof record.application === "string")
    && typeof record.plan === "string" && plans.has(record.plan)
    && isProductList(record.products) && isDomainList(record.domains)
    && isIsoDate(record.issuedAt) && isIsoDate(record.updatesUntil);
}

import type { QuireKitLicensePayload, QuireKitProduct } from "../types";

/** A license key split into its signed bytes and signature. */
export interface ParsedLicenseKey {
  /** UTF-8 JSON bytes covered by the signature. */ readonly body: Uint8Array;
  /** Ed25519 signature bytes. */ readonly signature: Uint8Array;
  /** Decoded payload. */ readonly payload: QuireKitLicensePayload;
}

const plans = new Set(["community", "education", "nonprofit", "commercial", "enterprise"]);
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
 * Splits and validates the shape of a license key without checking its signature.
 * @param key - `base64url(payload).base64url(signature)`.
 * @returns Parsed key, or null when the key or payload shape is malformed.
 */
export function parseLicenseKey(key: string): ParsedLicenseKey | null {
  const parts = key.trim().split(".");
  if (parts.length !== 2) return null;
  const body = decodeBase64url(parts[0]!), signature = decodeBase64url(parts[1]!);
  if (!body || !signature || signature.length !== 64) return null;
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(body)); } catch { return null; }
  return isPayload(value) ? { body, signature, payload: value } : null;
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
    && typeof record.plan === "string" && plans.has(record.plan)
    && Array.isArray(record.products) && record.products.every((item) => typeof item === "string" && products.has(item))
    && (record.domains === undefined || (Array.isArray(record.domains) && record.domains.every((item) => typeof item === "string")))
    && typeof record.issuedAt === "string" && isoDate.test(record.issuedAt)
    && typeof record.updatesUntil === "string" && isoDate.test(record.updatesUntil);
}

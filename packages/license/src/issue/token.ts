import { isTooBroad } from "../key/address";

/**
 * Encodes bytes as unpadded base64url without Node buffers, so issuance runs in browsers too.
 * @param bytes - Raw bytes.
 * @returns base64url text.
 */
export function encodeBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/**
 * Signs a JSON payload into a prefixed token.
 * @param prefix - Token prefix.
 * @param payload - Payload to sign.
 * @param privateKey - Ed25519 signing key.
 * @returns `prefix + base64url(payload).base64url(signature)`.
 */
export async function signToken(prefix: string, payload: object, privateKey: CryptoKey): Promise<string> {
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, privateKey, body));
  return `${prefix}${encodeBase64url(body)}.${encodeBase64url(signature)}`;
}

/**
 * Normalizes host names for issuance, rejecting wildcards wider than one domain or one `/24` block.
 * @param domains - Host names, `*.example.com`, IPv4 addresses or `192.168.10.*` blocks.
 * @returns Lower-case names without trailing dots, or undefined when none were given.
 */
export function normalizeDomains(domains: readonly string[] | undefined): readonly string[] | undefined {
  const normalized = (domains ?? []).map((value) => value.trim().toLowerCase().replace(/\.$/u, "")).filter(Boolean);
  const tooBroad = normalized.filter(isTooBroad);
  if (tooBroad.length > 0) throw new Error(`Wildcard too broad: ${tooBroad.join(", ")}`);
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Returns today's date for issuance records.
 * @returns `YYYY-MM-DD` in UTC.
 */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

import type { ParsedSignedToken } from "./codec";

/**
 * Verifies an Ed25519 signature with WebCrypto.
 * @param publicKey - Raw Ed25519 public key.
 * @param token - Parsed signed token.
 * @returns Whether the signature matches, or `unsupported` when the platform cannot verify Ed25519.
 */
export async function verifySignature(publicKey: Uint8Array, token: ParsedSignedToken<unknown>): Promise<boolean | "unsupported"> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return "unsupported";
  try {
    const key = await subtle.importKey("raw", publicKey as Uint8Array<ArrayBuffer>, { name: "Ed25519" }, false, ["verify"]);
    return await subtle.verify({ name: "Ed25519" }, key, token.signature as Uint8Array<ArrayBuffer>, token.body as Uint8Array<ArrayBuffer>);
  } catch {
    return "unsupported";
  }
}

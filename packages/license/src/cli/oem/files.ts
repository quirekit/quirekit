import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Vendor signing key file inside the vendor directory. */
export const vendorKeyFile = "vendor-signing-key.jwk";

/** Issuance log inside the vendor directory. */
export const issuanceLogFile = "issued-sub-licenses.jsonl";

/**
 * Writes the vendor private key, refusing to replace an existing one.
 * @param directory - Vendor directory.
 * @param jwk - Private key as JWK.
 */
export async function writeVendorKey(directory: string, jwk: JsonWebKey): Promise<void> {
  const path = join(directory, vendorKeyFile);
  if (existsSync(path)) throw new Error(`${path} already exists; keep it, since sub-licenses signed with it depend on it.`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(jwk)}\n`, { mode: 0o600 });
}

/**
 * Reads the vendor private key.
 * @param directory - Vendor directory.
 * @returns Private key as JWK.
 */
export async function readVendorKey(directory: string): Promise<JsonWebKey> {
  const path = join(directory, vendorKeyFile);
  if (!existsSync(path)) throw new Error(`${path} not found; run "quirekit-oem keygen" first.`);
  return JSON.parse(await readFile(path, "utf8")) as JsonWebKey;
}

/**
 * Appends one issued sub-license to the vendor's local log.
 * @param directory - Vendor directory.
 * @param record - Issued payload and token.
 */
export async function logIssuance(directory: string, record: object): Promise<void> {
  await appendFile(join(directory, issuanceLogFile), `${JSON.stringify(record)}\n`, { mode: 0o600 });
}

/**
 * Reads a token given inline or as a file path.
 * @param value - Token text or path to a file holding it.
 * @returns Trimmed token.
 */
export async function readToken(value: string): Promise<string> {
  return (existsSync(value) ? await readFile(value, "utf8") : value).trim();
}

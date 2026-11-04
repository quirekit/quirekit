import { v4 as uuidv4 } from "uuid";
import { isOfflineBinding, maxOfflineAddresses } from "../key/address";
import { parseOemCertificate, parseSubLicense } from "../key/oem/codec";
import { quireKitLicenseKeyPrefix, quireKitOemCertificatePrefix, quireKitSubLicensePrefix } from "../key/codec";
import type { QuireKitLicensePayload, QuireKitOemCertificatePayload, QuireKitSubLicensePayload } from "../types";
import { encodeBase64url, normalizeDomains, signToken, today } from "./token";
import type { QuireKitIssued, QuireKitLicenseKeyInput, QuireKitOemCertificateInput, QuireKitSubLicenseInput, QuireKitVendorSigningKey } from "./types";

const isoDate = /^\d{4}-\d{2}-\d{2}$/u;
const rawPublicKey = /^[A-Za-z0-9_-]{43}$/u;

/**
 * Issues a standard license key with the QuireKit issuer key.
 * @param issuerKey - QuireKit Ed25519 signing key.
 * @param input - Licensee, plan, products and update window.
 * @returns Signed key and its payload.
 */
export async function issueQuireKitLicenseKey(issuerKey: CryptoKey, input: QuireKitLicenseKeyInput): Promise<QuireKitIssued<QuireKitLicensePayload>> {
  requireText(input.licensee, "licensee");
  // Keys of the retired plan still verify; new ones are refused so no unpaid production key is signed.
  if (input.plan === "community") throw new Error("The community plan is no longer issued.");
  requireScope(input.products, input.updatesUntil);
  const domains = normalizeDomains(input.domains), application = input.application?.trim();
  const payload: QuireKitLicensePayload = {
    id: input.id ?? uuidv4(), licensee: input.licensee.trim(), ...(application ? { application } : {}), plan: input.plan,
    products: [...input.products], ...(domains ? { domains } : {}), issuedAt: today(), updatesUntil: input.updatesUntil
  };
  return { payload, token: await signToken(quireKitLicenseKeyPrefix, payload, issuerKey) };
}

/**
 * Issues an OEM certificate with the QuireKit issuer key.
 * @param issuerKey - QuireKit Ed25519 signing key.
 * @param input - Vendor, product, scope and vendor public keys.
 * @returns Signed certificate and its payload.
 */
export async function issueQuireKitOemCertificate(issuerKey: CryptoKey, input: QuireKitOemCertificateInput): Promise<QuireKitIssued<QuireKitOemCertificatePayload>> {
  for (const [value, field] of [[input.vendor, "vendor"], [input.vendorId, "vendorId"], [input.application, "application"]] as const) requireText(value, field);
  requireScope(input.products, input.updatesUntil);
  const publicKeys = input.publicKeys.map((key) => key.trim()).filter(Boolean);
  if (publicKeys.length === 0 || publicKeys.some((key) => !rawPublicKey.test(key))) throw new Error("Vendor public keys must be raw Ed25519 keys in base64url.");
  const countersignKey = input.countersignKey?.trim();
  if (countersignKey && !rawPublicKey.test(countersignKey)) throw new Error("The countersign key must be a raw Ed25519 key in base64url.");
  const payload: QuireKitOemCertificatePayload = {
    id: input.id ?? uuidv4(), vendor: input.vendor.trim(), vendorId: input.vendorId.trim(), application: input.application.trim(),
    products: [...input.products], issuedAt: today(), updatesUntil: input.updatesUntil, publicKeys,
    ...(countersignKey ? { countersignKey } : {}), ...(input.offline ? { offline: true } : {})
  };
  return { payload, token: await signToken(quireKitOemCertificatePrefix, payload, issuerKey) };
}

/**
 * Signs a sub-license for one end customer with a vendor key the certificate lists. Nothing is
 * sent anywhere: an online sub-license still needs the console countersignature, while an offline
 * one is complete but needs an offline certificate and bound addresses.
 * @param vendorKey - Vendor private key, as the JWK `quirekit-oem keygen` saves, or an imported key with its public key.
 * @param certificate - OEM certificate issued by QuireKit.
 * @param input - End customer and optional domains.
 * @returns Signed sub-license and its payload.
 */
export async function signQuireKitSubLicense(vendorKey: JsonWebKey | QuireKitVendorSigningKey, certificate: string, input: QuireKitSubLicenseInput): Promise<QuireKitIssued<QuireKitSubLicensePayload>> {
  requireText(input.licensee, "licensee");
  const parsed = parseOemCertificate(certificate);
  if (!parsed) throw new Error("The certificate is malformed.");
  // Signing with a key the certificate does not list would produce sub-licenses that never verify.
  const publicKey = "privateKey" in vendorKey ? vendorKey.publicKey : vendorKey.x;
  if (!publicKey || !parsed.payload.publicKeys.includes(publicKey)) throw new Error("The vendor key is not one of the public keys in this certificate.");
  if (today() > parsed.payload.updatesUntil) throw new Error(`The certificate expired on ${parsed.payload.updatesUntil}; renew it before issuing sub-licenses.`);
  const key = "privateKey" in vendorKey ? vendorKey.privateKey : await crypto.subtle.importKey("jwk", vendorKey, { name: "Ed25519" }, false, ["sign"]);
  const domains = normalizeDomains(input.domains);
  if (input.offline && parsed.payload.offline !== true) throw new Error("This certificate does not allow offline sub-licenses.");
  if (input.offline && !isOfflineBinding(domains)) throw new Error(`Offline sub-licenses must bind 1 to ${maxOfflineAddresses} addresses.`);
  const payload: QuireKitSubLicensePayload = {
    id: input.id ?? uuidv4(), vendorId: parsed.payload.vendorId, licensee: input.licensee.trim(), ...(domains ? { domains } : {}), issuedAt: today()
  };
  return { payload, token: await signToken(quireKitSubLicensePrefix, payload, key) };
}

/**
 * Adds the console countersignature to a sub-license signed today, so it verifies without
 * address binding. Callers verify the resulting chain before handing it out.
 * @param countersignKey - Console private key as JWK; its public key must be the certificate's countersign key.
 * @param subLicense - Vendor-signed sub-license without a countersignature.
 * @param certificate - OEM certificate the sub-license is signed under.
 * @returns Countersigned sub-license.
 */
export async function countersignQuireKitSubLicense(countersignKey: JsonWebKey, subLicense: string, certificate: string): Promise<string> {
  const sub = parseSubLicense(subLicense), cert = parseOemCertificate(certificate);
  if (!sub || !cert) throw new Error("The sub-license or certificate is malformed.");
  if (sub.countersignature) throw new Error("The sub-license is already countersigned.");
  if (!countersignKey.x || countersignKey.x !== cert.payload.countersignKey) throw new Error("The countersign key is not the one in this certificate.");
  // The countersignature vouches for the issue date, so only today's sub-licenses under a current certificate qualify.
  if (sub.payload.issuedAt !== today()) throw new Error("Only sub-licenses signed today can be countersigned.");
  if (today() > cert.payload.updatesUntil) throw new Error(`The certificate expired on ${cert.payload.updatesUntil}; renew it before issuing sub-licenses.`);
  const key = await crypto.subtle.importKey("jwk", countersignKey, { name: "Ed25519" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, sub.body as Uint8Array<ArrayBuffer>));
  return `${subLicense.trim()}.${encodeBase64url(signature)}`;
}

/**
 * Creates a vendor key pair.
 * @returns Private key as JWK, and the public key to send to QuireKit.
 */
export async function generateQuireKitVendorKey(): Promise<{ readonly privateKey: JsonWebKey; readonly publicKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const privateKey = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { privateKey, publicKey: privateKey.x! };
}

/**
 * @param value - Field value.
 * @param field - Field name for the error.
 */
function requireText(value: string, field: string): void {
  if (!value?.trim()) throw new Error(`${field} is required.`);
}

/**
 * @param products - Covered product lines.
 * @param updatesUntil - Last covered release date.
 */
function requireScope(products: readonly string[], updatesUntil: string): void {
  if (products.length === 0) throw new Error("At least one product line is required.");
  if (!isoDate.test(updatesUntil)) throw new Error("updatesUntil must be YYYY-MM-DD.");
}

import { beforeAll, describe, expect, it } from "vitest";
import type { QuireKitLicenseContext, QuireKitOemCertificatePayload, QuireKitSubLicensePayload } from "../../types";
import { verifyQuireKitLicenseKey } from "../verify";

const subtle = globalThis.crypto.subtle;
let issuer: CryptoKeyPair, vendor: CryptoKeyPair, stranger: CryptoKeyPair, countersigner: CryptoKeyPair;
let issuerPublicKey: Uint8Array, vendorPublicKey: string, countersignPublicKey: string;

/** @param bytes - Raw bytes. @returns Unpadded base64url text. */
function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/** @param prefix - Token prefix. @param payload - Signed content. @param key - Signing key. @returns Signed token. */
async function sign(prefix: string, payload: object, key: CryptoKey): Promise<string> {
  const body = new TextEncoder().encode(JSON.stringify(payload));
  return `${prefix}${encode(body)}.${encode(new Uint8Array(await subtle.sign({ name: "Ed25519" }, key, body)))}`;
}

/** @param overrides - Certificate fields to change. @returns A certificate signed by the test issuer. */
function certificate(overrides: Partial<QuireKitOemCertificatePayload> = {}): Promise<string> {
  return sign("qkc1_", { id: "cert-1", vendor: "某软件厂商", vendorId: "vendor-1", application: "合同管理系统", products: ["classic"],
    issuedAt: "2026-11-03", updatesUntil: "2027-11-03", publicKeys: [vendorPublicKey], countersignKey: countersignPublicKey, ...overrides }, issuer.privateKey);
}

/**
 * @param overrides - Sub-license fields to change. @param key - Vendor signing key.
 * @param countersignKey - Key adding the console countersignature, or null for an offline sub-license.
 * @returns A sub-license.
 */
async function subLicense(overrides: Partial<QuireKitSubLicensePayload> = {}, key = vendor.privateKey, countersignKey: CryptoKey | null = countersigner.privateKey): Promise<string> {
  const token = await sign("qks1_", { id: "sub-1", vendorId: "vendor-1", licensee: "某银行", issuedAt: "2026-11-04", ...overrides }, key);
  if (!countersignKey) return token;
  const body = Uint8Array.from(atob(token.slice(5).split(".")[0]!.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
  return `${token}.${encode(new Uint8Array(await subtle.sign({ name: "Ed25519" }, countersignKey, body)))}`;
}

/** @param overrides - Context fields to change. @returns Context verifying against the test issuer. */
async function context(overrides: Partial<QuireKitLicenseContext> = {}): Promise<QuireKitLicenseContext> {
  return { product: "classic", publicKey: issuerPublicKey, certificate: await certificate(), application: "合同管理系统", ...overrides };
}

beforeAll(async () => {
  const generate = () => subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
  [issuer, vendor, stranger, countersigner] = await Promise.all([generate(), generate(), generate(), generate()]);
  issuerPublicKey = new Uint8Array(await subtle.exportKey("raw", issuer.publicKey));
  vendorPublicKey = encode(new Uint8Array(await subtle.exportKey("raw", vendor.publicKey)));
  countersignPublicKey = encode(new Uint8Array(await subtle.exportKey("raw", countersigner.publicKey)));
});

describe("OEM certificate chain", () => {
  it("licenses a vendor sub-license under the certificate its product ships", async () => {
    expect(await verifyQuireKitLicenseKey(await subLicense(), await context())).toEqual({
      status: "licensed", plan: "oem", licensee: "某银行", id: "sub-1", updatesUntil: "2027-11-03",
      vendor: "某软件厂商", application: "合同管理系统"
    });
    // Product names compare without case or surrounding space.
    expect((await verifyQuireKitLicenseKey(await subLicense(), await context({ application: " 合同管理系统 " }))).status).toBe("licensed");
  });

  it("keeps the same sub-license valid after the vendor renews its certificate", async () => {
    const sub = await subLicense();
    const renewed = await context({ certificate: await certificate({ id: "cert-2", updatesUntil: "2028-11-03" }), releaseDate: "2028-06-01" });
    expect(await verifyQuireKitLicenseKey(sub, renewed)).toMatchObject({ status: "licensed", updatesUntil: "2028-11-03" });
    expect((await verifyQuireKitLicenseKey(sub, await context({ releaseDate: "2028-06-01" }))).reason).toBe("updates-expired");
  });

  it("rejects sub-licenses signed after the certificate's update window unless a renewed certificate covers them", async () => {
    const late = await subLicense({ issuedAt: "2027-11-04" });
    expect((await verifyQuireKitLicenseKey(late, await context())).reason).toBe("certificate-lapsed");
    expect((await verifyQuireKitLicenseKey(await subLicense({ issuedAt: "2027-11-03" }), await context())).status).toBe("licensed");
    const renewed = await context({ certificate: await certificate({ id: "cert-2", updatesUntil: "2028-11-03" }) });
    expect((await verifyQuireKitLicenseKey(late, renewed)).status).toBe("licensed");
  });

  it("accepts sub-licenses signed by any vendor key the certificate lists", async () => {
    const strangerKey = encode(new Uint8Array(await subtle.exportKey("raw", stranger.publicKey)));
    const rotated = await context({ certificate: await certificate({ publicKeys: [strangerKey, vendorPublicKey] }) });
    expect((await verifyQuireKitLicenseKey(await subLicense(), rotated)).status).toBe("licensed");
    expect((await verifyQuireKitLicenseKey(await subLicense({}, stranger.privateKey), rotated)).status).toBe("licensed");
  });

  it("requires a QuireKit-issued certificate declared for the same product", async () => {
    const sub = await subLicense();
    expect((await verifyQuireKitLicenseKey(sub, await context({ certificate: undefined }))).reason).toBe("certificate");
    const forged = await sign("qkc1_", { id: "cert-x", vendor: "x", vendorId: "vendor-1", application: "合同管理系统", products: ["*"],
      issuedAt: "2026-11-03", updatesUntil: "2099-01-01", publicKeys: [vendorPublicKey] }, vendor.privateKey);
    expect((await verifyQuireKitLicenseKey(sub, await context({ certificate: forged }))).reason).toBe("certificate");
    expect((await verifyQuireKitLicenseKey(sub, await context({ application: "档案系统" }))).reason).toBe("application");
    expect((await verifyQuireKitLicenseKey(sub, await context({ application: undefined }))).reason).toBe("application");
  });

  it("rejects sub-licenses from another key or vendor and revoked issuances", async () => {
    expect((await verifyQuireKitLicenseKey(await subLicense({}, stranger.privateKey), await context())).reason).toBe("signature");
    expect((await verifyQuireKitLicenseKey(await subLicense({ vendorId: "vendor-2" }), await context())).reason).toBe("vendor");
    const sub = await subLicense();
    expect((await verifyQuireKitLicenseKey(sub, await context({ revoked: new Set(["cert-1"]) }))).reason).toBe("revoked");
    expect((await verifyQuireKitLicenseKey(sub, await context({ revoked: new Set(["sub-1"]) }))).reason).toBe("revoked");
  });

  it("takes product lines from the certificate and domains from the sub-license", async () => {
    expect((await verifyQuireKitLicenseKey(await subLicense(), await context({ product: "md" }))).reason).toBe("product");
    const bound = await subLicense({ domains: ["docs.bank.example"] });
    expect((await verifyQuireKitLicenseKey(bound, await context({ hostname: "docs.bank.example" }))).status).toBe("licensed");
    expect((await verifyQuireKitLicenseKey(bound, await context({ hostname: "other.example" }))).reason).toBe("domain");
  });

  it("requires the console countersignature unless an offline certificate covers a bound sub-license", async () => {
    const offline = await context({ certificate: await certificate({ offline: true }), hostname: "docs.bank.example" });
    expect((await verifyQuireKitLicenseKey(await subLicense({}, vendor.privateKey, null), await context())).reason).toBe("countersign");
    expect((await verifyQuireKitLicenseKey(await subLicense({}, vendor.privateKey, stranger.privateKey), await context())).reason).toBe("countersign");
    expect((await verifyQuireKitLicenseKey(await subLicense({ domains: ["docs.bank.example"] }, vendor.privateKey, null), await context({ hostname: "docs.bank.example" }))).reason).toBe("countersign");
    expect((await verifyQuireKitLicenseKey(await subLicense({ domains: ["docs.bank.example"] }, vendor.privateKey, null), offline)).status).toBe("licensed");
    // Offline sub-licenses must bind one to five addresses no wider than one /24 block.
    expect((await verifyQuireKitLicenseKey(await subLicense({}, vendor.privateKey, null), offline)).reason).toBe("countersign");
    expect((await verifyQuireKitLicenseKey(await subLicense({ domains: ["192.168.*"] }, vendor.privateKey, null), offline)).reason).toBe("countersign");
    const many = ["a", "b", "c", "d", "e", "f"].map((name) => `${name}.bank.example`);
    expect((await verifyQuireKitLicenseKey(await subLicense({ domains: many }, vendor.privateKey, null), offline)).reason).toBe("countersign");
  });

  it("matches IPv4 addresses and /24 blocks", async () => {
    const bound = await subLicense({ domains: ["10.1.2.3", "192.168.10.*"] }, vendor.privateKey, null);
    const cert = await certificate({ offline: true });
    for (const [hostname, status] of [["10.1.2.3", "licensed"], ["192.168.10.23", "licensed"], ["192.168.11.23", "invalid"], ["10.1.2.30", "invalid"]] as const) {
      expect((await verifyQuireKitLicenseKey(bound, await context({ certificate: cert, hostname }))).status).toBe(status);
    }
  });
});

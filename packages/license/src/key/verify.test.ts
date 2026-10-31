import { beforeAll, describe, expect, it } from "vitest";
import type { QuireKitLicensePayload } from "../types";
import { coversProduct, hostMatches, verifyQuireKitLicenseKey } from "./verify";

const subtle = globalThis.crypto.subtle;
let signer: CryptoKey;
let publicKey: Uint8Array;

/** @param bytes - Raw bytes. @returns Unpadded base64url text. */
function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/** @param overrides - Payload fields to change. @returns A key signed by the test issuer. */
async function issue(overrides: Partial<QuireKitLicensePayload> = {}): Promise<string> {
  const payload: QuireKitLicensePayload = { id: "test-1", licensee: "测试学校", plan: "education", products: ["classic"],
    issuedAt: "2026-10-20", updatesUntil: "2027-10-20", ...overrides };
  const body = new TextEncoder().encode(JSON.stringify(payload));
  return `${encode(body)}.${encode(new Uint8Array(await subtle.sign({ name: "Ed25519" }, signer, body)))}`;
}

beforeAll(async () => {
  const pair = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
  signer = pair.privateKey;
  publicKey = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
});

describe("license key verification", () => {
  it("licenses a valid key for a covered product and reports its plan", async () => {
    expect(await verifyQuireKitLicenseKey(await issue(), { product: "classic", publicKey }))
      .toEqual({ status: "licensed", plan: "education", licensee: "测试学校" });
  });
  it("treats a missing key as evaluation and the open-source value as licensed", async () => {
    expect(await verifyQuireKitLicenseKey(undefined, { product: "classic", publicKey })).toEqual({ status: "evaluation", reason: "missing" });
    expect(await verifyQuireKitLicenseKey(" open-source ", { product: "docx", publicKey })).toEqual({ status: "licensed", plan: "open-source" });
  });
  it("rejects malformed keys, foreign signatures and tampered payloads", async () => {
    expect((await verifyQuireKitLicenseKey("not-a-key", { product: "classic", publicKey })).reason).toBe("malformed");
    const key = await issue();
    expect((await verifyQuireKitLicenseKey(key, { product: "classic" })).reason).toBe("signature");
    const [, signature] = key.split(".");
    const forged = `${encode(new TextEncoder().encode(JSON.stringify({ id: "test-1", licensee: "x", plan: "enterprise", products: ["*"],
      issuedAt: "2026-10-20", updatesUntil: "2099-01-01" })))}.${signature}`;
    expect((await verifyQuireKitLicenseKey(forged, { product: "classic", publicKey })).reason).toBe("signature");
  });
  it("enforces products, domains, the update window and revocation", async () => {
    expect((await verifyQuireKitLicenseKey(await issue(), { product: "md", publicKey })).reason).toBe("product");
    const everything = await issue({ products: ["*"] });
    expect((await verifyQuireKitLicenseKey(everything, { product: "md", publicKey })).status).toBe("licensed");
    const scoped = await issue({ domains: ["*.example.com"] });
    expect((await verifyQuireKitLicenseKey(scoped, { product: "classic", publicKey, hostname: "docs.example.com" })).status).toBe("licensed");
    expect((await verifyQuireKitLicenseKey(scoped, { product: "classic", publicKey, hostname: "evil.com" })).reason).toBe("domain");
    expect((await verifyQuireKitLicenseKey(scoped, { product: "classic", publicKey })).reason).toBe("domain");
    expect((await verifyQuireKitLicenseKey(everything, { product: "md", publicKey })).status).toBe("licensed");
    const key = await issue();
    expect((await verifyQuireKitLicenseKey(key, { product: "classic", publicKey, releaseDate: "2027-10-20" })).status).toBe("licensed");
    expect((await verifyQuireKitLicenseKey(key, { product: "classic", publicKey, releaseDate: "2027-10-21" })).reason).toBe("updates-expired");
    expect((await verifyQuireKitLicenseKey(key, { product: "classic", publicKey, revoked: new Set(["test-1"]) })).reason).toBe("revoked");
  });
  it("lets professional Classic cover standard Classic and Classic cover its DOCX, never the add-ons", () => {
    expect(coversProduct(["classic-pro"], "classic")).toBe(true);
    expect(coversProduct(["classic-pro"], "docx")).toBe(true);
    expect(coversProduct(["md"], "docx") && coversProduct(["md"], "export")).toBe(true);
    expect(coversProduct(["classic"], "docx")).toBe(true);
    expect(coversProduct(["classic"], "classic-pro")).toBe(false);
    expect(coversProduct(["classic-pro"], "export")).toBe(false);
    expect(coversProduct(["docx"], "classic")).toBe(false);
    expect(coversProduct(["*"], "md")).toBe(true);
  });
  it("matches exact hosts and wildcard subdomains", () => {
    expect(hostMatches("example.com", "EXAMPLE.com")).toBe(true);
    expect(hostMatches("example.com", "a.example.com")).toBe(false);
    expect(hostMatches("*.example.com", "example.com")).toBe(true);
    expect(hostMatches("*.example.com", "badexample.com")).toBe(false);
    expect(hostMatches("example.com.", "example.com")).toBe(true);
  });
});

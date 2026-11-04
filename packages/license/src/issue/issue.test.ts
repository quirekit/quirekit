import { describe, expect, it } from "vitest";
import { verifyQuireKitLicenseKey } from "../key/verify";
import { countersignQuireKitSubLicense, generateQuireKitVendorKey, issueQuireKitLicenseKey, issueQuireKitOemCertificate, signQuireKitSubLicense } from "./issue";

/** @returns A test issuer key pair with its raw public key. */
async function issuer(): Promise<{ readonly privateKey: CryptoKey; readonly publicKey: Uint8Array }> {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
  return { privateKey: pair.privateKey, publicKey: new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)) };
}

describe("issuance", () => {
  it("issues standard keys the verifier accepts", async () => {
    const { privateKey, publicKey } = await issuer();
    const { token, payload } = await issueQuireKitLicenseKey(privateKey, {
      licensee: " 某公司 ", application: "OA", plan: "commercial", products: ["classic"], domains: ["Docs.Example.com."], updatesUntil: "2027-11-03"
    });
    expect(token.startsWith("qk1_")).toBe(true);
    expect(payload).toMatchObject({ licensee: "某公司", application: "OA", domains: ["docs.example.com"] });
    expect(await verifyQuireKitLicenseKey(token, { product: "classic", publicKey, hostname: "docs.example.com" }))
      .toMatchObject({ status: "licensed", id: payload.id });
  });

  it("chains certificates and vendor sub-licenses end to end", async () => {
    const { privateKey, publicKey } = await issuer();
    const vendor = await generateQuireKitVendorKey();
    const countersigner = await generateQuireKitVendorKey();
    const certificate = await issueQuireKitOemCertificate(privateKey, {
      vendor: "某厂商", vendorId: "acme", application: "合同系统", products: ["classic-pro"], updatesUntil: "2027-11-03", publicKeys: [vendor.publicKey],
      countersignKey: countersigner.publicKey
    });
    const sub = await signQuireKitSubLicense(vendor.privateKey, certificate.token, { licensee: "某银行" });
    const context = { product: "classic", publicKey, certificate: certificate.token, application: "合同系统" } as const;
    expect((await verifyQuireKitLicenseKey(sub.token, context)).reason).toBe("countersign");
    const countersigned = await countersignQuireKitSubLicense(countersigner.privateKey, sub.token, certificate.token);
    expect(await verifyQuireKitLicenseKey(countersigned, context)).toMatchObject({ status: "licensed", plan: "oem", licensee: "某银行", vendor: "某厂商" });
    await expect(countersignQuireKitSubLicense(vendor.privateKey, sub.token, certificate.token)).rejects.toThrow("countersign key");
    await expect(countersignQuireKitSubLicense(countersigner.privateKey, countersigned, certificate.token)).rejects.toThrow("already");
    const other = await generateQuireKitVendorKey();
    await expect(signQuireKitSubLicense(other.privateKey, certificate.token, { licensee: "x" })).rejects.toThrow("not one of the public keys");
  });

  it("signs offline sub-licenses only under offline certificates and with bound addresses", async () => {
    const { privateKey, publicKey } = await issuer();
    const vendor = await generateQuireKitVendorKey();
    const input = { vendor: "某厂商", vendorId: "acme", application: "合同系统", products: ["classic"], updatesUntil: "2027-11-03", publicKeys: [vendor.publicKey] } as const;
    const online = await issueQuireKitOemCertificate(privateKey, input);
    const offline = await issueQuireKitOemCertificate(privateKey, { ...input, offline: true });
    await expect(signQuireKitSubLicense(vendor.privateKey, online.token, { licensee: "某银行", domains: ["a.bank.example"], offline: true })).rejects.toThrow("offline");
    await expect(signQuireKitSubLicense(vendor.privateKey, offline.token, { licensee: "某银行", offline: true })).rejects.toThrow("bind");
    await expect(signQuireKitSubLicense(vendor.privateKey, offline.token, { licensee: "某银行", domains: ["10.*"], offline: true })).rejects.toThrow("too broad");
    const sub = await signQuireKitSubLicense(vendor.privateKey, offline.token, { licensee: "某银行", domains: ["192.168.10.*"], offline: true });
    expect((await verifyQuireKitLicenseKey(sub.token, { product: "classic", publicKey, certificate: offline.token, application: "合同系统", hostname: "192.168.10.8" })).status).toBe("licensed");
  });

  it("refuses sub-licenses once the certificate's update window has ended", async () => {
    const { privateKey } = await issuer();
    const vendor = await generateQuireKitVendorKey();
    const lapsed = await issueQuireKitOemCertificate(privateKey, {
      vendor: "某厂商", vendorId: "acme", application: "合同系统", products: ["classic"], updatesUntil: "2020-01-01", publicKeys: [vendor.publicKey]
    });
    await expect(signQuireKitSubLicense(vendor.privateKey, lapsed.token, { licensee: "某银行" })).rejects.toThrow("renew");
  });

  it("rejects incomplete input and over-broad wildcards", async () => {
    const { privateKey } = await issuer();
    await expect(issueQuireKitLicenseKey(privateKey, { licensee: "", plan: "commercial", products: ["classic"], updatesUntil: "2027-11-03" })).rejects.toThrow("licensee");
    await expect(issueQuireKitLicenseKey(privateKey, { licensee: "x", plan: "commercial", products: ["classic"], domains: ["*.com"], updatesUntil: "2027-11-03" })).rejects.toThrow("too broad");
    await expect(issueQuireKitLicenseKey(privateKey, { licensee: "x", plan: "community", products: ["classic"], updatesUntil: "2027-11-03" })).rejects.toThrow("no longer issued");
  });
});

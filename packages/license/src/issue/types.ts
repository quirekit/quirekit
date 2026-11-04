import type { QuireKitPlan, QuireKitProduct } from "../types";

/** Fields chosen when issuing a standard license key. */
export interface QuireKitLicenseKeyInput {
  /** Licensed person or organization. */ readonly licensee: string;
  /** Optional application the key is sold for. */ readonly application?: string | undefined;
  /** Plan. */ readonly plan: QuireKitPlan;
  /** Covered product lines. */ readonly products: readonly (QuireKitProduct | "*")[];
  /** Optional host names; empty or absent means any host. */ readonly domains?: readonly string[] | undefined;
  /** Last covered release date, `YYYY-MM-DD`. */ readonly updatesUntil: string;
  /** Issuance identifier; generated when absent. */ readonly id?: string | undefined;
}

/** Fields chosen when issuing an OEM certificate. */
export interface QuireKitOemCertificateInput {
  /** Vendor name. */ readonly vendor: string;
  /** Vendor identifier its sub-licenses carry. */ readonly vendorId: string;
  /** Vendor product the certificate is limited to. */ readonly application: string;
  /** Covered product lines. */ readonly products: readonly (QuireKitProduct | "*")[];
  /** Last covered release date, `YYYY-MM-DD`. */ readonly updatesUntil: string;
  /** Vendor Ed25519 public keys, raw and base64url. */ readonly publicKeys: readonly string[];
  /** Console countersign public key, raw and base64url. */ readonly countersignKey?: string | undefined;
  /** Whether the vendor may sign address-bound sub-licenses offline. */ readonly offline?: boolean | undefined;
  /** Issuance identifier; generated when absent. */ readonly id?: string | undefined;
}

/** Fields a vendor chooses when issuing a sub-license. */
export interface QuireKitSubLicenseInput {
  /** End customer. */ readonly licensee: string;
  /** Host names or IPv4 patterns; required for offline sub-licenses, otherwise absent means any host. */ readonly domains?: readonly string[] | undefined;
  /** Whether the sub-license is used without the console countersignature; requires an offline certificate. */ readonly offline?: boolean | undefined;
  /** Issuance identifier; generated when absent. */ readonly id?: string | undefined;
}

/** A vendor key already imported for signing, such as a non-extractable key held by a browser page. */
export interface QuireKitVendorSigningKey {
  /** Ed25519 private key usable for signing. */ readonly privateKey: CryptoKey;
  /** Matching public key, raw and base64url, as listed in certificates. */ readonly publicKey: string;
}

/** A signed token together with the payload it carries, as issuance logs record it. */
export interface QuireKitIssued<T> {
  /** Signed payload. */ readonly payload: T;
  /** Complete token, including its prefix. */ readonly token: string;
}

/**
 * Commercial product lines a license key can cover. `classic` is the standard Classic online
 * document editor, `classic-pro` adds review, forms and official templates, `export` is the
 * PDF/OFD add-on, `md` the MD Editor enhancements and `docx` the standalone DOCX SDK.
 */
export type QuireKitProduct = "classic" | "classic-pro" | "export" | "md" | "docx";

/** License plans; every plan removes the evaluation notice for the products it covers. `open-source` keys are issued to reviewed open-source projects; `community` keys are no longer issued but still verify. */
export type QuireKitPlan = "community" | "education" | "nonprofit" | "commercial" | "enterprise" | "open-source";

/** Plan reported for a sub-license issued by an OEM vendor. */
export type QuireKitCheckPlan = QuireKitPlan | "oem";

/** Signed content of a license key. */
export interface QuireKitLicensePayload {
  /** Issuance identifier used for support and revocation. */ readonly id: string;
  /** Licensed person or organization. */ readonly licensee: string;
  /** Optional application the key was sold for; informational only. */ readonly application?: string;
  /** Plan that issued the key. */ readonly plan: QuireKitPlan;
  /** Covered product lines; `*` covers every product. */ readonly products: readonly (QuireKitProduct | "*")[];
  /** Optional host names, with `*.example.com` wildcards; absent means any host, including headless use. */ readonly domains?: readonly string[];
  /** Issue date, `YYYY-MM-DD`. */ readonly issuedAt: string;
  /** Releases built on or before this date stay licensed forever, `YYYY-MM-DD`. */ readonly updatesUntil: string;
}

/** Signed content of an OEM certificate, issued by QuireKit to a vendor for one of its products. */
export interface QuireKitOemCertificatePayload {
  /** Issuance identifier used for revocation. */ readonly id: string;
  /** Vendor name. */ readonly vendor: string;
  /** Vendor identifier its sub-licenses must carry. */ readonly vendorId: string;
  /** Vendor product the certificate is limited to. */ readonly application: string;
  /** Covered product lines; `*` covers every product. */ readonly products: readonly (QuireKitProduct | "*")[];
  /** Issue date, `YYYY-MM-DD`. */ readonly issuedAt: string;
  /** Releases built on or before this date stay licensed forever, `YYYY-MM-DD`. */ readonly updatesUntil: string;
  /** Vendor Ed25519 public keys, raw and base64url; a sub-license signed by any of them verifies, so a replaced vendor key keeps earlier sub-licenses valid. */ readonly publicKeys: readonly string[];
  /** Console countersign public key, raw and base64url; sub-licenses carrying its signature verify without address binding. */ readonly countersignKey?: string;
  /** Whether the vendor may also sign address-bound sub-licenses offline, without the console countersignature. */ readonly offline?: boolean;
}

/** Signed content of a sub-license a vendor issues to one end customer. */
export interface QuireKitSubLicensePayload {
  /** Issuance identifier used for tracing and revocation. */ readonly id: string;
  /** Issuing vendor; must match the certificate. */ readonly vendorId: string;
  /** End customer. */ readonly licensee: string;
  /** Optional host names, with `*.example.com` wildcards; absent means any host, including headless use. */ readonly domains?: readonly string[];
  /** Issue date, `YYYY-MM-DD`. */ readonly issuedAt: string;
}

/** OEM certificate a vendor product ships, with the product name it declares. */
export interface QuireKitOemDeclaration {
  /** Certificate issued by QuireKit to the vendor. */ readonly certificate: string;
  /** Vendor product name; must match the certificate. */ readonly application: string;
}

/** Outcome of checking a sub-license against its certificate, before revocation and entitlement checks. */
export type QuireKitSubLicenseChainResult =
  | { readonly ok: true; readonly certificate: QuireKitOemCertificatePayload; readonly subLicense: QuireKitSubLicensePayload }
  | { readonly ok: false; readonly reason: QuireKitLicenseReason };

/** Outcome of checking one product. */
export type QuireKitLicenseStatus = "licensed" | "evaluation" | "invalid";

/** Why a product is not licensed. */
export type QuireKitLicenseReason =
  | "missing"
  | "malformed"
  | "signature"
  | "revoked"
  | "product"
  | "domain"
  | "updates-expired"
  | "certificate"
  | "application"
  | "vendor"
  | "certificate-lapsed"
  | "countersign"
  | "unsupported";

/** Result of a license check for one product. */
export interface QuireKitLicenseCheck {
  /** Whether the evaluation notice must be shown. */ readonly status: QuireKitLicenseStatus;
  /** Plan of a verified key; absent on local development hosts. */ readonly plan?: QuireKitCheckPlan;
  /** Licensee of a verified key. */ readonly licensee?: string;
  /** Issuance identifier of a verified key, written into exported files for tracing. */ readonly id?: string;
  /** Last release date a verified key covers, `YYYY-MM-DD`. */ readonly updatesUntil?: string;
  /** Vendor of a verified OEM sub-license. */ readonly vendor?: string;
  /** Vendor product of a verified OEM sub-license. */ readonly application?: string;
  /** Cause of an evaluation or invalid result. */ readonly reason?: QuireKitLicenseReason;
}

/** Environment facts a check depends on; omitted fields are read from the running platform. */
export interface QuireKitLicenseContext {
  /** Product line being checked. */ readonly product: QuireKitProduct;
  /** Current host name; undefined outside a browser, where domain-bound keys never apply. */ readonly hostname?: string | undefined;
  /** Build date of the running release, `YYYY-MM-DD`; undefined skips the update window check. */ readonly releaseDate?: string | undefined;
  /** Raw Ed25519 public key; defaults to the QuireKit issuer key. */ readonly publicKey?: Uint8Array;
  /** Revoked issuance identifiers. */ readonly revoked?: ReadonlySet<string>;
  /** OEM certificate shipped by the host product; required for sub-licenses. */ readonly certificate?: string | undefined;
  /** Product name the host declared alongside its OEM certificate. */ readonly application?: string | undefined;
}

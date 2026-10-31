/**
 * Commercial product lines a license key can cover. `classic` is the standard Classic online
 * document editor, `classic-pro` adds review, forms and official templates, `export` is the
 * PDF/OFD add-on, `md` the MD Editor enhancements and `docx` the standalone DOCX SDK.
 */
export type QuireKitProduct = "classic" | "classic-pro" | "export" | "md" | "docx";

/** License plans; every plan removes the evaluation notice for the products it covers. */
export type QuireKitPlan = "community" | "education" | "nonprofit" | "commercial" | "enterprise" | "open-source";

/** Signed content of a license key. */
export interface QuireKitLicensePayload {
  /** Issuance identifier used for support and revocation. */ readonly id: string;
  /** Licensed person or organization. */ readonly licensee: string;
  /** Plan that issued the key. */ readonly plan: Exclude<QuireKitPlan, "open-source">;
  /** Covered product lines; `*` covers every product. */ readonly products: readonly (QuireKitProduct | "*")[];
  /** Optional host names, with `*.example.com` wildcards; absent means any host, including headless use. */ readonly domains?: readonly string[];
  /** Issue date, `YYYY-MM-DD`. */ readonly issuedAt: string;
  /** Releases built on or before this date stay licensed forever, `YYYY-MM-DD`. */ readonly updatesUntil: string;
}

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
  | "unsupported";

/** Result of a license check for one product. */
export interface QuireKitLicenseCheck {
  /** Whether the evaluation notice must be shown. */ readonly status: QuireKitLicenseStatus;
  /** Plan of a licensed key; `open-source` for the self-declared open-source value. */ readonly plan?: QuireKitPlan;
  /** Licensee of a verified key. */ readonly licensee?: string;
  /** Cause of an evaluation or invalid result. */ readonly reason?: QuireKitLicenseReason;
}

/** Environment facts a check depends on; omitted fields are read from the running platform. */
export interface QuireKitLicenseContext {
  /** Product line being checked. */ readonly product: QuireKitProduct;
  /** Current host name; undefined outside a browser, where domain-bound keys never apply. */ readonly hostname?: string | undefined;
  /** Build date of the running release, `YYYY-MM-DD`; undefined skips the update window check. */ readonly releaseDate?: string | undefined;
  /** Raw Ed25519 public key; defaults to the QuireKit issuer key. */ readonly publicKey?: Uint8Array;
  /** Revoked issuance identifiers. */ readonly revoked?: ReadonlySet<string>;
}

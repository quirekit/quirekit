/** QuireKit issuer public key (raw Ed25519, base64url). The private half never enters a repository. */
export const quireKitIssuerPublicKey = "P7slgtn8BmyGTrxDV-Ro_QpMLv7cBfMTsRPOj3Lvmg8";

/** Issuance identifiers withdrawn after a key leaked or a refund. */
export const revokedLicenseIds: ReadonlySet<string> = new Set<string>();

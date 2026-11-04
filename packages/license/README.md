# @quirekit/license

English | [简体中文](./README.zh-CN.md)

Manages license configuration and checks for commercial QuireKit features in an application.

## Installation

This is a private workspace package, not a public npm install. Reference it with `workspace:*` inside the QuireKit workspace.

## Usage

Set your issued license with `setQuireKitLicense()` during application startup. Use `checkQuireKitLicense()` to inspect its status. The licensor supplies the license; this package does not issue one.

### OEM vendors

A vendor that ships QuireKit inside its own product to many customers holds an OEM certificate and signs one sub-license per customer:

1. Generate a signing key in your vendor account of the QuireKit issuance console; QuireKit then issues a certificate (`qkc1_…`) for your product.
2. In your product code, call `setQuireKitOemCertificate(certificate, { application: "<product name in the certificate>" })`.
3. For each customer, sign a sub-license (`qks1_…`) in the console, which checks the certificate and countersigns it, and configure it with `setQuireKitLicense()` in that deployment.
   Countersigned sub-licenses need no address binding, so desktop, server and intranet deployments can use them.

Renewing the certificate only changes the certificate shipped in your next release; customers keep their sub-licenses. An expired certificate cannot sign new ones.

Vendors whose certificate allows offline issuance can also run `npx quirekit-oem keygen` and
`npx quirekit-oem issue --certificate cert.txt --licensee "<customer>" --domains <addresses>`, or call
`signQuireKitSubLicense(vendorPrivateKey, certificate, { licensee, domains, offline: true })` from `@quirekit/license/issue`.
Offline sub-licenses must bind 1 to 5 addresses: host names, `*.example.com`, IPv4 addresses or at most one `/24` block such as `192.168.10.*`.

## Related documentation

- [Related package](../classic-pro/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

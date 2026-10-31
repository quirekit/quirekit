# @quirekit/license

English | [简体中文](./README.zh-CN.md)

Manages license configuration and checks for commercial QuireKit features in an application.

## Installation

This is a private workspace package, not a public npm install. Reference it with `workspace:*` inside the QuireKit workspace.

## Usage

Set your issued license with `setQuireKitLicense()` during application startup. Use `checkQuireKitLicense()` to inspect its status. The licensor supplies the license; this package does not issue one.

## Related documentation

- [Related package](../classic-pro/README.md)

## License

[Commercial license](./LICENSE.md): free for development and evaluation; production use requires a license key. Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

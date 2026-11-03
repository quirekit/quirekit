# @quirekit/extension-proofing

English | [简体中文](./README.zh-CN.md)

Adds spelling and grammar findings, suggestions and correction commands. A replaceable provider performs the checks.

## Installation

```bash
npm install @quirekit/extension-proofing
```

## Usage

Install Proofing in Core and configure its provider. Use proofing-harper for English grammar and style or proofing-hunspell for dictionary-based spelling. Read getProofingSnapshot to show results in your own panel or menu.

## Things to know

- Findings should not silently rewrite text; let the user choose corrections.
- Language support depends on the provider and loaded dictionaries.

## Related documentation

- [Harper provider](../../proofing-harper/README.md)
- [Hunspell provider](../../proofing-hunspell/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

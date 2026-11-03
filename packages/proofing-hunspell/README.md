# @quirekit/proofing-hunspell

English | [简体中文](./README.zh-CN.md)

Checks spelling with Hunspell dictionaries, for applications that need to choose their own languages and word lists.

## Installation

```bash
npm install @quirekit/proofing-hunspell
```

## Usage

Create a service with `createHunspellProofingProvider()` and pass it to the configuration of `@quirekit/extension-proofing`. The extension displays results in the document.

## Things to know

- Supply the required engine resources or dictionaries. Language coverage depends on the configuration.
- Suggestions assist review; the user decides whether to apply them.

## Related documentation

- [Editor proofing extension](../extensions/proofing/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/media

English | [简体中文](./README.zh-CN.md)

Manages image and other media references, separating identifiers stored in documents from the code that loads files.

## Installation

```bash
npm install @quirekit/media
```

## Usage

Use asset references for files in application storage and external references for URLs. Connect file loaders with `createQuireMediaResolverChain()`. Use `createQuireMemoryMediaRepository()` for tests or temporary content.

## Related documentation

- [Related package](../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

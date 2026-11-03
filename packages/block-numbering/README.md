# @quirekit/block-numbering

English | [简体中文](./README.zh-CN.md)

Adds shared Word bullets and automatic numbering to Block Editor.

## Installation

```bash
npm install @quirekit/block-numbering
```

## Usage

Call `createBlockNumberingExtensions()` and add the returned array to Block Editor’s `extensions`. Applications opt into these features; base Block Editor remains usable on its own.

## Things to know

- Reuses Word numbering rules and adapts their display and editing to a continuous page; no Classic window is needed.

## Related documentation

- [Block Editor setup](../block-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/cm-autocomplete

English | [简体中文](./README.zh-CN.md)

Provides completion lists and automatic bracket closing in CodeMirror.

## Installation

```bash
npm install @quirekit/cm-autocomplete
```

## Usage

Add autocompletion() to the editor’s extensions. Your completion source returns suggestions; accepting a suggestion edits the document.

## Things to know

- Maintained from `@codemirror/autocomplete` 6.20.3; UPSTREAM.json records its origin and local changes.
- Use @quirekit/cm-* consistently within an editor rather than mixing official @codemirror/* instances.

## Related documentation

- [Markdown editor using these packages](../../msfe/core/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/cm-legacy-modes

English | [简体中文](./README.zh-CN.md)

Provides older CodeMirror language modes for syntaxes without a dedicated modern package.

## Installation

```bash
npm install @quirekit/cm-legacy-modes
```

## Usage

Import a language from /mode/<name> and wrap it with StreamLanguage.define(...) from cm-language. There is no root import. The package’s mode directory lists available modes.

## Things to know

- Maintained from `@codemirror/legacy-modes` 6.5.4; UPSTREAM.json records its origin and local changes.
- Use @quirekit/cm-* consistently within an editor rather than mixing official @codemirror/* instances.

## Related documentation

- [Markdown editor using these packages](../../msfe/core/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

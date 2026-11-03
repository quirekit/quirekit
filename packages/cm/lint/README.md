# @quirekit/cm-lint

English | [简体中文](./README.zh-CN.md)

Shows diagnostics and their locations in CodeMirror.

## Installation

```bash
npm install @quirekit/cm-lint
```

## Usage

Use linter(source) to connect a checker. The source returns diagnostics with from, to, severity and message. This package is not a checker for a particular language.

## Things to know

- Maintained from `@codemirror/lint` 6.9.7; UPSTREAM.json records its origin and local changes.
- Use @quirekit/cm-* consistently within an editor rather than mixing official @codemirror/* instances.

## Related documentation

- [Markdown editor using these packages](../../msfe/core/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

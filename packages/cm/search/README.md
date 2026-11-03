# @quirekit/cm-search

English | [简体中文](./README.zh-CN.md)

Provides search, replacement, a search panel and match highlighting for CodeMirror.

## Installation

```bash
npm install @quirekit/cm-search
```

## Usage

Add search() and bind searchKeymap with keymap.of(...) from cm-view. Call openSearchPanel(view) to open the panel.

## Things to know

- Maintained from `@codemirror/search` 6.7.2; UPSTREAM.json records its origin and local changes.
- Use @quirekit/cm-* consistently within an editor rather than mixing official @codemirror/* instances.

## Related documentation

- [Markdown editor using these packages](../../msfe/core/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

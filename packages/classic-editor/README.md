# @quirekit/classic-editor

English | [简体中文](./README.zh-CN.md)

QuireKit’s paginated document editor interface, with a toolbar, pages, selections and controls for embedded objects. Pair it with the Classic Word preset for headers, footers, tables and other Word features.

## Installation

```bash
npm install @quirekit/classic-editor
```

## Usage

Mount it in a browser with `createClassicEditor({ element, preset, plugins })`. The Classic DOCX guide below has a complete Word example. The `preset` selects document features; `plugins` add interface features such as file actions.

## Things to know

- Import `@quirekit/classic-editor/styles.css`. Vue components are exported from `@quirekit/classic-editor/vue`.
- Read the document with the instance’s `getJSON()` and call `destroy()` when finished.
- Your app supplies persistence, uploads and authentication. Public packages are currently alpha; check API changes when upgrading.

## Related documentation

- [Complete Word setup](../classic-docx/README.md)
- [Additional Word features](../classic-pro/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

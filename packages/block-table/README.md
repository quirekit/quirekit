# @quirekit/block-table

English | [简体中文](./README.zh-CN.md)

Adds Word table nodes and commands to Block Editor.

## Installation

```bash
npm install @quirekit/block-table
```

## Usage

Call `createBlockTableExtensions()` and add the returned array to Block Editor’s `extensions`. Applications opt into these features; base Block Editor remains usable on its own.

## Things to know

- Tables do not turn the continuous document into a paginated editor. Add the Vue table menu through Block’s tools slot.
- The menu offers Grid, Ruled and Striped styles, plus header-row and header-column switches. Content, dimensions and text formatting remain intact, and changes are undoable.
- Structural selections and cell carets accept TSV / HTML table content. Paste expands to the right and bottom when needed; incompatible merged cells reject the entire operation and keep the original content.
- Styles persist in JSON documents. Block’s static HTML file export flattens built-in appearances into portable CSS.

## Related documentation

- [Block Editor setup](../block-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

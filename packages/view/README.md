# @quirekit/view

English | [简体中文](./README.zh-CN.md)

QuireKit’s document view and input layer. It draws documents, handles mouse selections, carets, input methods and scrolling, and sends edits back to the editor core.

## Installation

```bash
npm install @quirekit/view
```

## Usage

For a custom editor, add `canvasViewExtension()` or `svgViewExtension()` to Core’s extensions and select the matching `mode`. Continuous-flow HTML display comes from [`@quirekit/view-html`](../view-html/README.md). Most applications can start with Classic or Block Editor instead.

## Things to know

- Import `@quirekit/view/styles.css` and give the mount container explicit dimensions.
- This package handles display and input, not Word document structure. Document feature packages supply page, paragraph and table layout rules.
- Views of the same document should share a Core instance. Release mounted views when the instance is destroyed.

## Related documentation

- [Editor core](../core/editor/README.md)
- [Classic product](../classic-editor/README.md)
- [Block product](../block-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

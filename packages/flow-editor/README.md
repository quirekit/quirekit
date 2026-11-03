# @quirekit/flow-editor

English | [简体中文](./README.zh-CN.md)

An editor for flowcharts. Provides an editing interface that can also be opened from an embedded document object.

## Installation

```bash
npm install @quirekit/flow-editor
```

## Usage

Open an editing dialog with `openFlowchartDialog()`, supply the current data and save the accepted result in your application. Use `createFlowEditor()` for a direct mount. Import the Vue component `QuireFlowEditor` from `@quirekit/flow-editor/vue`.

## Things to know

- Import interface styles from `@quirekit/flow-editor/styles.css`.
- Replace document content after the user accepts the edit; keep the original on cancel. Your app supplies persistence and media uploads.

## Related documentation

- [Data formats and operations](../flowchart/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

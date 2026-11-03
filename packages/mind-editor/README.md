# @quirekit/mind-editor

English | [简体中文](./README.zh-CN.md)

An editor for mind maps. Provides an editing interface that can also be opened from an embedded document object.

## Installation

```bash
npm install @quirekit/mind-editor
```

## Usage

Open an editing dialog with `openMindMapDialog()`, supply the current data and save the accepted result in your application. Use `createMindEditor()` for a direct mount. Import the Vue component `QuireMindEditor` from `@quirekit/mind-editor/vue`.

## Things to know

- Import interface styles from `@quirekit/mind-editor/styles.css`.
- Replace document content after the user accepts the edit; keep the original on cancel. Your app supplies persistence and media uploads.

## Related documentation

- [Data formats and operations](../mind-map/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

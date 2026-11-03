# @quirekit/whiteboard-editor

English | [简体中文](./README.zh-CN.md)

An editor for whiteboards. Provides an editing interface that can also be opened from an embedded document object.

## Installation

```bash
npm install @quirekit/whiteboard-editor
```

## Usage

Open an editing dialog with `openWhiteboardDialog()`, supply the current data and save the accepted result in your application. Import the Vue component `WhiteboardEditor` from `@quirekit/whiteboard-editor/vue`.

## Things to know

- Import interface styles from `@quirekit/whiteboard-editor/styles.css`.
- Replace document content after the user accepts the edit; keep the original on cancel. Your app supplies persistence and media uploads.

## Related documentation

- [Data formats and operations](../whiteboard/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/data-view-editor

English | [简体中文](./README.zh-CN.md)

An editor for data views. Provides an editing interface that can also be opened from an embedded document object.

## Installation

```bash
npm install @quirekit/data-view-editor
```

The consuming project also needs: `vue` (^3.5.0).

## Usage

Open an editing dialog with `openDataViewDialog()`, supply the current data and save the accepted result in your application.

## Things to know

- Import interface styles from `@quirekit/data-view-editor/styles.css`.
- Replace document content after the user accepts the edit; keep the original on cancel. Your app supplies persistence and media uploads.

## Related documentation

- [Data formats and operations](../data-view/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

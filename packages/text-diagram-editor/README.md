# @quirekit/text-diagram-editor

English | [简体中文](./README.zh-CN.md)

An editor for text diagrams. Edit diagram source and view a preview, with Mermaid, PlantUML and DOT support.

## Installation

```bash
npm install @quirekit/text-diagram-editor
```

## Usage

Open an editing dialog with `openTextDiagramDialog()`, supply the current data and save the accepted result in your application. Import the Vue component `TextDiagramEditor` from `@quirekit/text-diagram-editor/vue`.

## Things to know

- Import interface styles from `@quirekit/text-diagram-editor/styles.css`.
- Replace document content after the user accepts the edit; keep the original on cancel. Your app supplies persistence and media uploads.

## Related documentation

- [Data formats and operations](../text-diagram/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

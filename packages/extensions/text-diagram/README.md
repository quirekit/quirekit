# @quirekit/extension-text-diagram

English | [简体中文](./README.zh-CN.md)

Embeds text diagrams as document blocks in Core, Block or Classic, retaining editable data and a preview.

## Installation

```bash
npm install @quirekit/extension-text-diagram
```

## Usage

Add `TextDiagram` to Core’s `extensions` and use `text-diagram-editor` for the editing interface. The extension supplies the document block; your application still wires creation, editing and saving. A product preset may already include it, so check that setup before adding another copy. A custom entry can use `openTextDiagram`.

## Things to know

- Keep the original document if the text diagrams dialog is cancelled; commit data and its matching preview only after confirmation.
- The host editor owns document copying, undo and persistence. A temporary graphical draft is not a saved document.

## Related documentation

- [Text diagrams workspace](../../text-diagram-editor/README.md)
- [Block Editor setup](../../block-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

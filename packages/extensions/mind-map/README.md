# @quirekit/extension-mind-map

English | [简体中文](./README.zh-CN.md)

Embeds mind maps as document blocks in Core, Block or Classic, retaining editable data and a preview.

## Installation

```bash
npm install @quirekit/extension-mind-map
```

## Usage

Add `MindMap` to Core’s `extensions` and use `mind-editor` for the editing interface. The extension supplies the document block; your application still wires creation, editing and saving. A product preset may already include it, so check that setup before adding another copy. A custom entry can use `openMindMap`.

## Things to know

- Keep the original document if the mind maps dialog is cancelled; commit data and its matching preview only after confirmation.
- The host editor owns document copying, undo and persistence. A temporary graphical draft is not a saved document.

## Related documentation

- [Mind maps workspace](../../mind-editor/README.md)
- [Block Editor setup](../../block-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

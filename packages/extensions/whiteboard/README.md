# @quirekit/extension-whiteboard

English | [简体中文](./README.zh-CN.md)

Embeds whiteboards as document blocks in Core, Block or Classic, retaining editable data and a preview.

## Installation

```bash
npm install @quirekit/extension-whiteboard
```

## Usage

Add `Whiteboard` to Core’s `extensions` and use `whiteboard-editor` for the editing interface. The extension supplies the document block; your application still wires creation, editing and saving. A product preset may already include it, so check that setup before adding another copy.

## Things to know

- Keep the original document if the whiteboards dialog is cancelled; commit data and its matching preview only after confirmation.
- The host editor owns document copying, undo and persistence. A temporary graphical draft is not a saved document.

## Related documentation

- [Whiteboards workspace](../../whiteboard-editor/README.md)
- [Block Editor setup](../../block-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

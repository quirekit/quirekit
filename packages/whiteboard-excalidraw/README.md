# @quirekit/whiteboard-excalidraw

English | [简体中文](./README.zh-CN.md)

Connects the Excalidraw drawing interface to QuireKit data for whiteboards, including dragging, selecting and editing shapes.

## Installation

```bash
npm install @quirekit/whiteboard-excalidraw
```

## Usage

Call `createExcalidrawWhiteboard()` in a browser with a mount container, the current document and update handling. Most applications can use the complete editor linked below.

## Things to know

- Read QuireKit data through the adapter when saving; do not persist the drawing library’s temporary runtime state as the document.
- Release the instance and its listeners when unmounting.

## Related documentation

- [Data tools](../whiteboard/README.md)
- [Complete editor](../whiteboard-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

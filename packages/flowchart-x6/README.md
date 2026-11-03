# @quirekit/flowchart-x6

English | [简体中文](./README.zh-CN.md)

Connects the X6 drawing interface to QuireKit data for flowcharts, including dragging, selecting and editing shapes.

## Installation

```bash
npm install @quirekit/flowchart-x6
```

## Usage

Call `createX6FlowchartEditor()` in a browser with a mount container, the current document and update handling. Most applications can use the complete editor linked below.

## Things to know

- Read QuireKit data through the adapter when saving; do not persist the drawing library’s temporary runtime state as the document.
- Release the instance and its listeners when unmounting.

## Related documentation

- [Data tools](../flowchart/README.md)
- [Complete editor](../flow-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

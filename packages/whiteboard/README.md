# @quirekit/whiteboard

English | [简体中文](./README.zh-CN.md)

Whiteboard data formats and persistence helpers. Stores a board scene and its preview for standalone editors and embedded document boards.

## Installation

```bash
npm install @quirekit/whiteboard
```

## Usage

Also install `uuid` for this example. Keep generated IDs when saving; do not recreate them each time a document is read.

```ts
import { createWhiteboardDocument, serializeWhiteboard } from '@quirekit/whiteboard'
import { v4 as uuid } from 'uuid'

const board = createWhiteboardDocument(uuid(), 'Project ideas')
console.log(serializeWhiteboard(board))
```

## Things to know

- Creating an empty document does not generate a preview image. Update the scene and preview together when saving from an editor.

## Related documentation

- [Whiteboard editor](../whiteboard-editor/README.md)
- [Word conversion](../whiteboard-docx/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

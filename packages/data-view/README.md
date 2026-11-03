# @quirekit/data-view

English | [简体中文](./README.zh-CN.md)

Data tools for presenting records as tables or boards. Includes fields, records, view settings, queries and edits.

## Installation

```bash
npm install @quirekit/data-view
```

## Usage

Also install `uuid` for this example. Keep generated IDs when saving; do not recreate them each time a document is read.

```ts
import { createDataView, serializeDataView } from '@quirekit/data-view'
import { v4 as uuid } from 'uuid'

const view = createDataView(uuid())
console.log(serializeDataView(view))
```

## Things to know

- A new data view includes title and status fields plus table and board views. Add records through your app or an editing interface.
- This is not a database service. Your app handles remote data, permissions and persistence.

## Related documentation

- [Data view editor](../data-view-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

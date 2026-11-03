# @quirekit/flowchart

English | [简体中文](./README.zh-CN.md)

Data tools for flowcharts: create nodes and edges, validate data, save JSON and manage editing drafts, independently of a drawing interface.

## Installation

```bash
npm install @quirekit/flowchart
```

## Usage

Also install `uuid` for this example. Keep generated IDs when saving; do not recreate them each time a document is read.

```ts
import { createFlowchart, createFlowchartNode, serializeFlowchart } from '@quirekit/flowchart'
import { v4 as uuid } from 'uuid'

const chart = createFlowchart()
const node = createFlowchartNode(uuid(), 'process', { x: 40, y: 40 }, 'Review')
const source = serializeFlowchart({ ...chart, nodes: [node] })
console.log(source)
```

## Related documentation

- [Flowchart editor](../flow-editor/README.md)
- [Word conversion](../flowchart-docx/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

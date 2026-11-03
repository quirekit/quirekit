# @quirekit/mind-map

English | [简体中文](./README.zh-CN.md)

Data tools for mind maps. Create maps from an outline, change topics and layout, and save documents that remain editable.

## Installation

```bash
npm install @quirekit/mind-map
```

## Usage

This creates a map with two branches and serializes it.

```ts
import { createMindMapDocument, serializeMindMap } from '@quirekit/mind-map'

const map = createMindMapDocument({
  text: 'Project',
  children: [
    { text: 'Research', children: [] },
    { text: 'Delivery', children: [] },
  ],
})
console.log(serializeMindMap(map))
```

## Related documentation

- [Mind map editor](../mind-editor/README.md)
- [Word conversion](../mind-map-docx/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

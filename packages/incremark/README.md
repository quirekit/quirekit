# @quirekit/incremark

English | [简体中文](./README.zh-CN.md)

A Vue Markdown reader for complete articles and AI responses that arrive a little at a time. It displays content and does not provide an editing toolbar.

## Installation

```bash
npm install @quirekit/incremark
```

## Usage

Pass the full current text as `content`. For streaming responses, each update should contain all text received so far, not just the newest chunk.

```vue
<script setup lang="ts">
import { QuireMarkdown } from '@quirekit/incremark/vue'
import '@quirekit/incremark/styles.css'

const content = '## Hello\n\nThis is **Markdown**.'
</script>

<template>
  <QuireMarkdown :content="content" />
</template>
```

## Things to know

- Use `status="receiving"` while streaming and `complete` when finished. Change `identity` for a new message so the component can release the previous message’s resources.
- Do not treat HTML inside Markdown as a trusted page. Configure an explicit HTML handling policy when enabling it.

## Related documentation

- [React component](../incremark-react/README.md)
- [Parsing and streaming state](../incremark-core/README.md)
- [Markdown editor](../md-editor/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

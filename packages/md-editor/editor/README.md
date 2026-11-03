# @quirekit/md-editor

English | [简体中文](./README.zh-CN.md)

A Markdown editor with a toolbar. Switch between live editing and source editing while keeping Markdown text as the saved document. Useful for articles, notes and AI-generated content.

## Installation

```bash
npm install @quirekit/md-editor
```

## Usage

This is a minimal Vue view. `markdown` supplies the initial content. Use the component’s exposed `editor` to replace or save the document later.

```vue
<script setup lang="ts">
import { MdEditor } from '@quirekit/md-editor/vue'
import '@quirekit/md-editor/styles.css'

const markdown = '# Hello\n\nStart writing here.'
</script>

<template>
  <MdEditor :markdown="markdown" label="Document" />
</template>
```

## Things to know

- `markdown` is not a two-way binding. Save with `editor.getMarkdown()`; changing the prop is not a document reset.
- Connect image uploads through `images`; document search also needs a service from your app. Comments and AI come from the commercial packages `@quirekit/md-editor-comments` and `@quirekit/md-editor-ai`.
- Use `MdProse` or Incremark for reading only, or MSFE if you just need the editor engine.

## Related documentation

- [Editor engine](../../msfe/core/README.md)
- [Markdown reader](../../incremark/README.md)
- [AI panel](../ai/README.md)
- [File export](../export/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

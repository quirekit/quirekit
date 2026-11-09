# @quirekit/md-editor

English | [简体中文](./README.zh-CN.md)

A Markdown editor with a toolbar. Switch between live editing and source editing while keeping Markdown text as the saved document. Useful for articles, notes and AI-generated content.

## Installation

```bash
npm install @quirekit/md-editor @quirekit/ui @quirekit/unocss-preset @ark-ui/vue vue
```

## Usage

This is a minimal Vue view. `markdown` supplies the initial content. Use the component’s exposed `editor` to replace or save the document later.

```vue
<script setup lang="ts">
import { createTheme, defaultBaseTokens, quireIconRegistry } from '@quirekit/ui'
import { QuireIconProvider, QuireThemeProvider } from '@quirekit/ui/vue'
import { MdEditor } from '@quirekit/md-editor/vue'
import '@quirekit/unocss-preset/quirekit.css'
import '@quirekit/ui/styles.css'
import '@quirekit/md-editor/styles.css'

const theme = createTheme({ profile: 'precision', scheme: 'light', sources: { primary: defaultBaseTokens.color.source.cobalt } })
const markdown = '# Hello\n\nStart writing here.'
</script>

<template>
  <QuireIconProvider :registry="quireIconRegistry">
    <QuireThemeProvider :theme="theme">
      <MdEditor :markdown="markdown" label="Document" />
    </QuireThemeProvider>
  </QuireIconProvider>
</template>
```

## Performance

| Document | View | Update p50 | p90 | p95 | p99 | Next frame p50 | Next frame p95 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 KB | Document | 4.3 | 4.6 | 5.0 | 5.6 | 11.1 | 12.6 |
| 100 KB | Preview | 4.5 | 4.9 | 5.0 | 5.7 | 11.5 | 12.8 |
| 100 KB | Source | 3.4 | 3.8 | 3.9 | 4.5 | 7.5 | 9.6 |
| 1,000,000 chars | Document | 5.5 | 6.0 | 6.8 | 7.9 | 12.8 | 15.0 |
| 1,000,000 chars | Preview | 5.8 | 6.3 | 6.8 | 8.3 | 13.2 | 15.6 |
| 1,000,000 chars | Source | 4.4 | 5.0 | 6.1 | 9.4 | 8.4 | 12.0 |

Times are in milliseconds, over 200 keystrokes typed mid-document, with cold inputs included. This measures the complete `MdEditor` with its toolbar and diagrams, on documents made mostly of long paragraphs, on an Apple M3 Max in Chromium 149. **Update** is from key press to the editor accepting the new document, and **next frame** is from key press to the frame carrying the new text being produced. Keys are sent through the browser's automation protocol, so this excludes the keyboard, operating system, input method and display. Denser structure costs more, and results vary by machine.

To run it yourself in the QuireKit repository:

```bash
pnpm --filter @quirekit/msfe-docs performance:latency
```

## Things to know

- The two providers and both stylesheets are required: without them icons are blank and dark themes do not apply. Apps already using UnoCSS can use `presetQuireKit()` instead of `quirekit.css`.
- `markdown` is not a two-way binding. Save with `editor.getMarkdown()`; changing the prop is not a document reset.
- Connect image uploads through `images`; document search also needs a service from your app. Comments and AI come from the commercial packages `@quirekit/md-editor-comments` and `@quirekit/md-editor-ai`.
- If you bundle everything into one script, inline the `diagram-frame.iife.js` file from `@quirekit/text-diagram` (needed by PlantUML and Graphviz), and make `react` and `react-dom` reachable for the whiteboard's dynamic imports.
- Use `MdProse` or Incremark for reading only, or MSFE if you just need the editor engine.

## Related documentation

- [Editor engine](../../msfe/core/README.md)
- [Markdown reader](../../incremark/README.md)
- [AI panel](../ai/README.md)
- [File export](../export/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

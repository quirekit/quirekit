# @quirekit/msfe-bold

English | [简体中文](./README.zh-CN.md)

Recognizes Markdown bold markers and provides a command to toggle them.

## Installation

```bash
npm install @quirekit/msfe-bold
```

## Usage

MSFE StarterKit includes this feature. This browser example explicitly replaces its `bold` configuration so you can add options later. Also install msfe-core and msfe-starter-kit.

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { Bold } from '@quirekit/msfe-bold'

const parent = document.createElement('div')
document.body.append(parent)
const editor = createMsfeEditor({
  parent,
  documentId: 'example',
  markdown: "**Hello** Markdown",
  mode: 'live',
  extensions: [StarterKit.configure({ bold: Bold })],
})
editor.commands.toggleBold()
console.log(editor.getMarkdown())
// Call editor.destroy() when leaving the page.
```

## Things to know

- Text remains Markdown source. This is not the Bold extension for rich-text Core.
- Call editor.destroy() on disposal and editor.getMarkdown() when saving.

## Related documentation

- [MSFE setup and saving](../core/README.md)
- [Default extensions](../starter-kit/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

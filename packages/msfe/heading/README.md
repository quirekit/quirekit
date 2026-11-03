# @quirekit/msfe-heading

English | [简体中文](./README.zh-CN.md)

Recognizes Markdown headings and provides heading-level editing and navigation.

## Installation

```bash
npm install @quirekit/msfe-heading
```

## Usage

MSFE StarterKit includes this feature. This browser example explicitly replaces its `heading` configuration so you can add options later. Also install msfe-core and msfe-starter-kit.

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { Heading } from '@quirekit/msfe-heading'

const parent = document.createElement('div')
document.body.append(parent)
const editor = createMsfeEditor({
  parent,
  documentId: 'example',
  markdown: "# Hello",
  mode: 'live',
  extensions: [StarterKit.configure({ heading: Heading })],
})
editor.commands.setHeading(2)
console.log(editor.getMarkdown())
// Call editor.destroy() when leaving the page.
```

## Things to know

- Heading levels are saved by editing Markdown prefixes. Your outline or controls can call the commands.
- Call editor.destroy() on disposal and editor.getMarkdown() when saving.

## Related documentation

- [MSFE setup and saving](../core/README.md)
- [Default extensions](../starter-kit/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

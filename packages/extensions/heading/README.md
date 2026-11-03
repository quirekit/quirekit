# @quirekit/extension-heading

English | [简体中文](./README.zh-CN.md)

Turns paragraphs into headings at different levels for document structure and outlines.

## Installation

```bash
npm install @quirekit/extension-heading
```

## Usage

Add `Heading` to a Core editor’s `extensions`. StarterKit already includes headings; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Heading } from '@quirekit/extension-heading'

const editor = new Editor({
  extensions: [StarterKit.configure({ heading: false }), Heading],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.setHeading({ level: 2 })
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- Use the levels option to choose allowed levels. A table of contents requires a separate feature.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

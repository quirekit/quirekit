# @quirekit/extension-paragraph

English | [简体中文](./README.zh-CN.md)

Defines ordinary paragraphs and HTML `<p>` support. Use Core’s `setNode` command to turn the current text block into a paragraph.

## Installation

```bash
npm install @quirekit/extension-paragraph
```

## Usage

Add `Paragraph` to a Core editor’s `extensions`. StarterKit already includes paragraphs; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Paragraph } from '@quirekit/extension-paragraph'

const editor = new Editor({
  extensions: [StarterKit.configure({ paragraph: false }), Paragraph],
  content: {
    type: 'doc',
    content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.setNode('paragraph')
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- This is the generic paragraph. Use classic-paragraph for Word-specific indentation, tab stops and related settings.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

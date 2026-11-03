# @quirekit/extension-document

English | [简体中文](./README.zh-CN.md)

Defines the outer doc node that holds paragraphs, headings and other blocks.

## Installation

```bash
npm install @quirekit/extension-document
```

## Usage

Add `Document` to a Core editor’s `extensions`. StarterKit already includes the document root; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Document } from '@quirekit/extension-document'

const editor = new Editor({
  extensions: [StarterKit.configure({ document: false }), Document],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- Document does not define body content; a minimal editor also needs Paragraph and Text.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

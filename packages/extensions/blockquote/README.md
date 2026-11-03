# @quirekit/extension-blockquote

English | [简体中文](./README.zh-CN.md)

Adds block quotes for excerpts, quotations and notes.

## Installation

```bash
npm install @quirekit/extension-blockquote
```

## Usage

Add `Blockquote` to a Core editor’s `extensions`. StarterKit already includes block quotes; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Blockquote } from '@quirekit/extension-blockquote'

const editor = new Editor({
  extensions: [StarterKit.configure({ blockquote: false }), Blockquote],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.toggleBlockquote()
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- The quote is document structure; your application supplies attribution and source details.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

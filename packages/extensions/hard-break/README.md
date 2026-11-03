# @quirekit/extension-hard-break

English | [简体中文](./README.zh-CN.md)

Adds a line break within a paragraph, useful for addresses or verse.

## Installation

```bash
npm install @quirekit/extension-hard-break
```

## Usage

Add `HardBreak` to a Core editor’s `extensions`. StarterKit already includes line breaks; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { HardBreak } from '@quirekit/extension-hard-break'

const editor = new Editor({
  extensions: [StarterKit.configure({ hardBreak: false }), HardBreak],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.setHardBreak()
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- A line break is different from a new paragraph or a page break.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

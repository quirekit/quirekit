# @quirekit/extension-underline

English | [简体中文](./README.zh-CN.md)

Adds underlining, including single lines and other supported styles.

## Installation

```bash
npm install @quirekit/extension-underline
```

## Usage

Add `Underline` to a Core editor’s `extensions`. StarterKit already includes underlining; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Underline } from '@quirekit/extension-underline'

const editor = new Editor({
  extensions: [StarterKit.configure({ underline: false }), Underline],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.selectAll()
editor.commands.setUnderline({ underlineType: 'single' })
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- Underlining and links are separate features. Use extension-link to add a destination.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

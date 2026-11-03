# @quirekit/extension-bold

English | [简体中文](./README.zh-CN.md)

Adds bold text with commands to set, remove or toggle it.

## Installation

```bash
npm install @quirekit/extension-bold
```

## Usage

Add `Bold` to a Core editor’s `extensions`. StarterKit already includes bold text; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Bold } from '@quirekit/extension-bold'

const editor = new Editor({
  extensions: [StarterKit.configure({ bold: false }), Bold],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.selectAll()
editor.commands.toggleBold()
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- Changes selected text or subsequent typing; it does not add a toolbar.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

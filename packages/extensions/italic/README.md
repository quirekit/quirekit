# @quirekit/extension-italic

English | [简体中文](./README.zh-CN.md)

Adds or removes italic formatting on text.

## Installation

```bash
npm install @quirekit/extension-italic
```

## Usage

Add `Italic` to a Core editor’s `extensions`. StarterKit already includes italic text; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Italic } from '@quirekit/extension-italic'

const editor = new Editor({
  extensions: [StarterKit.configure({ italic: false }), Italic],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.selectAll()
editor.commands.toggleItalic()
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- The resulting glyphs depend on the fonts and italic faces available to the application.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

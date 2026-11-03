# @quirekit/extension-code

English | [简体中文](./README.zh-CN.md)

Marks a short piece of text as code, such as a function or command name.

## Installation

```bash
npm install @quirekit/extension-code
```

## Usage

Add `Code` to a Core editor’s `extensions`. StarterKit already includes inline code; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Code } from '@quirekit/extension-code'

const editor = new Editor({
  extensions: [StarterKit.configure({ code: false }), Code],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.selectAll()
editor.commands.toggleCode()
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- Use extension-code-block for multiline source. This package never executes code.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

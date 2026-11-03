# @quirekit/extension-strike

English | [简体中文](./README.zh-CN.md)

Adds a strikethrough to indicate completed or discarded text.

## Installation

```bash
npm install @quirekit/extension-strike
```

## Usage

Add `Strike` to a Core editor’s `extensions`. StarterKit already includes strikethrough; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Strike } from '@quirekit/extension-strike'

const editor = new Editor({
  extensions: [StarterKit.configure({ strike: false }), Strike],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.selectAll()
editor.commands.toggleStrike()
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- Strikethrough is formatting. It neither deletes text nor creates a Word tracked deletion.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

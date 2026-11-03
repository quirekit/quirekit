# @quirekit/extension-horizontal-rule

English | [简体中文](./README.zh-CN.md)

Inserts a horizontal separator between content blocks.

## Installation

```bash
npm install @quirekit/extension-horizontal-rule
```

## Usage

Add `HorizontalRule` to a Core editor’s `extensions`. StarterKit already includes horizontal rules; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { HorizontalRule } from '@quirekit/extension-horizontal-rule'

const editor = new Editor({
  extensions: [StarterKit.configure({ horizontalRule: false }), HorizontalRule],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.setHorizontalRule()
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- A rule is a separate block, not a paragraph or page border.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

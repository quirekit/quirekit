# @quirekit/extension-text

English | [简体中文](./README.zh-CN.md)

Defines the text nodes used inside paragraphs, headings and other text containers.

## Installation

```bash
npm install @quirekit/extension-text
```

## Usage

Add `Text` to a Core editor’s `extensions`. StarterKit already includes text nodes; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Text } from '@quirekit/extension-text'

const editor = new Editor({
  extensions: [StarterKit.configure({ text: false }), Text],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- Text has no standalone UI and does not set fonts, colors or paragraph styles.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

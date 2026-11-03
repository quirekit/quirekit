# @quirekit/extension-code-block

English | [简体中文](./README.zh-CN.md)

Stores multiline code with a language attribute and fenced-code input rules.

## Installation

```bash
npm install @quirekit/extension-code-block
```

## Usage

Add `CodeBlock` to a Core editor’s `extensions`. StarterKit already includes code blocks; this example disables its copy before installing this package. It edits document data without mounting a UI. Also install `@quirekit/core` and `@quirekit/starter-kit`.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { CodeBlock } from '@quirekit/extension-code-block'

const editor = new Editor({
  extensions: [StarterKit.configure({ codeBlock: false }), CodeBlock],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.setCodeBlock({ language: 'javascript' })
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- The language attribute identifies the language; highlighting and execution require separate application code.
- For an interactive surface, add DOM View, View or a product editor.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Creating an editor](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

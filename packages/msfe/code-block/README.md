# @quirekit/msfe-code-block

English | [简体中文](./README.zh-CN.md)

Recognizes fenced Markdown code blocks and lets users change their language.

## Installation

```bash
npm install @quirekit/msfe-code-block
```

## Usage

MSFE StarterKit includes this feature. This browser example explicitly replaces its `codeBlock` configuration so you can add options later. Also install msfe-core and msfe-starter-kit.

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { CodeBlock } from '@quirekit/msfe-code-block'

const parent = document.createElement('div')
document.body.append(parent)
const editor = createMsfeEditor({
  parent,
  documentId: 'example',
  markdown: "```javascript\nconst answer = 42\n```",
  mode: 'live',
  extensions: [StarterKit.configure({ codeBlock: CodeBlock })],
})
console.log(editor.getMarkdown())
// Call editor.destroy() when leaving the page.
```

## Things to know

- Code stays inside the fence; this package does not execute it.
- Call editor.destroy() on disposal and editor.getMarkdown() when saving.

## Related documentation

- [MSFE setup and saving](../core/README.md)
- [Default extensions](../starter-kit/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/msfe-link

English | [简体中文](./README.zh-CN.md)

Recognizes Markdown links and provides insertion, editing and navigation helpers.

## Installation

```bash
npm install @quirekit/msfe-link
```

## Usage

MSFE StarterKit includes this feature. This browser example explicitly replaces its `link` configuration so you can add options later. Also install msfe-core and msfe-starter-kit.

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { Link } from '@quirekit/msfe-link'

const parent = document.createElement('div')
document.body.append(parent)
const editor = createMsfeEditor({
  parent,
  documentId: 'example',
  markdown: "[Example](https://example.com)",
  mode: 'live',
  extensions: [StarterKit.configure({ link: Link })],
})
console.log(editor.getMarkdown())
// Call editor.destroy() when leaving the page.
```

## Things to know

- The application controls navigation. Showing a link card does not automatically rewrite the Markdown.
- Call editor.destroy() on disposal and editor.getMarkdown() when saving.

## Related documentation

- [MSFE setup and saving](../core/README.md)
- [Default extensions](../starter-kit/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

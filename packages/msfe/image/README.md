# @quirekit/msfe-image

English | [简体中文](./README.zh-CN.md)

Recognizes Markdown images and provides hooks for display, pasting and uploads.

## Installation

```bash
npm install @quirekit/msfe-image
```

## Usage

MSFE StarterKit includes this feature. This browser example explicitly replaces its `image` configuration so you can add options later. Also install msfe-core and msfe-starter-kit.

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { Image } from '@quirekit/msfe-image'

const parent = document.createElement('div')
document.body.append(parent)
const editor = createMsfeEditor({
  parent,
  documentId: 'example',
  markdown: "# Pictures",
  mode: 'live',
  extensions: [StarterKit.configure({ image: Image })],
})
console.log(editor.getMarkdown())
// Call editor.destroy() when leaving the page.
```

## Things to know

- For server uploads, provide an `ImageUploader` through `Image.configure({ upload })`. Use `resolve` to turn document addresses into display URLs.
- Call editor.destroy() on disposal and editor.getMarkdown() when saving.

## Related documentation

- [MSFE setup and saving](../core/README.md)
- [Default extensions](../starter-kit/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

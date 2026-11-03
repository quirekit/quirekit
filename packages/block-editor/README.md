# @quirekit/block-editor

English | [简体中文](./README.zh-CN.md)

A block editor for web documents, including paragraphs, lists, images and embedded content. Use it for notes, knowledge bases and working documents. Content is stored as QuireKit JSON.

## Installation

```bash
npm install @quirekit/block-editor
```

## Usage

This browser example creates an editing area. For the title bar, toolbar and block menus, use `BlockEditor` from `@quirekit/block-editor/vue` with the same `instance` and a `title`.

```ts
import { createBlockEditor } from '@quirekit/block-editor'
import '@quirekit/block-editor/styles.css'

const element = document.createElement('div')
document.body.append(element)
const instance = createBlockEditor({
  element,
  locale: 'zh-CN', // Also supports en
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
})
instance.setLocale('en') // Preserves content, selection and undo history
console.log(instance.editor.getJSON())
```

## Things to know

- Call `instance.destroy()` when leaving the page. Use `unmount()` and later `mount(element)` to temporarily remove the view.
- The editor has no built-in Save button or autosave. Applications manage JSON, titles and storage through Core content and event APIs. The Vue UI retains explicit file import and export.
- The interface defaults to Chinese and supports `locale: 'en'`, `instance.setLocale()` and `instance.onLocaleChange()`. The Vue language control updates shared components and extension tool slots without translating document content.
- Choose Md Editor for Markdown source documents, or Classic for Word page settings and DOCX workflows.

## Related documentation

- [Markdown editor](../md-editor/editor/README.md)
- [Classic editor](../classic-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

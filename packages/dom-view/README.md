# @quirekit/dom-view

English | [简体中文](./README.zh-CN.md)

Mounts QuireKit documents in a traditional browser DOM editor. Use it when you need contenteditable editing, or to compare behavior across view implementations.

## Installation

```bash
npm install @quirekit/dom-view
```

## Usage

Also install `@quirekit/core` and `@quirekit/starter-kit`, then create an editor in a browser.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { DomViewExtension } from '@quirekit/dom-view'

const element = document.createElement('div')
document.body.append(element)
const editor = new Editor({
  element,
  mode: 'dom',
  extensions: [StarterKit, DomViewExtension],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
})
console.log(editor.getJSON())
```

## Things to know

- Call `editor.destroy()` when leaving the page.
- The DOM view does not provide Word page layout. Use Classic for a paginated document interface.

## Related documentation

- [Editor core](../core/editor/README.md)
- [Paginated editor](../classic-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

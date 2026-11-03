# @quirekit/extension-link

English | [简体中文](./README.zh-CN.md)

Adds text links, with commands to insert, update and remove them and helpers to validate addresses.

## Installation

```bash
npm install @quirekit/extension-link
```

## Usage

Add `Link` to Core’s `extensions`. This data-only example also needs `@quirekit/core` and `@quirekit/starter-kit`. Call the same commands from your own toolbar or input handlers.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Link } from '@quirekit/extension-link'

const editor = new Editor({
  extensions: [StarterKit, Link],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }] },
})
editor.commands.selectAll()
editor.commands.setLink({ href: 'https://example.com' })
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- Your application decides whether navigation is allowed and where links open; saving a link does not open it.

## Related documentation

- [Core setup](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

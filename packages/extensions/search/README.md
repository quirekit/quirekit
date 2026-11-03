# @quirekit/extension-search

English | [简体中文](./README.zh-CN.md)

Finds text, navigates matches and replaces content. Your application supplies the search box.

## Installation

```bash
npm install @quirekit/extension-search
```

## Usage

Add `Search` to Core’s `extensions`. This data-only example also needs `@quirekit/core` and `@quirekit/starter-kit`. Call the same commands from your own toolbar or input handlers.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Search } from '@quirekit/extension-search'

const editor = new Editor({
  extensions: [StarterKit, Search],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }] },
})
editor.commands.setSearchQuery('QuireKit')
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- The current query and match highlights are temporary UI state, not document content.

## Related documentation

- [Core setup](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

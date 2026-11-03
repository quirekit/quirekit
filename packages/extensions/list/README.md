# @quirekit/extension-list

English | [简体中文](./README.zh-CN.md)

Provides bullet lists, ordered lists, list items and their keyboard behavior.

## Installation

```bash
npm install @quirekit/extension-list
```

## Usage

StarterKit includes these features. For custom setups, use ListKit or choose BulletList, OrderedList, ListItem and ListKeymap separately. The example replaces the preset lists; also install core and starter-kit.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { ListKit } from '@quirekit/extension-list'

const editor = new Editor({
  extensions: [
    StarterKit.configure({ bulletList: false, orderedList: false, listItem: false, listKeymap: false }),
    ListKit,
  ],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First item' }] }] },
})
editor.commands.toggleBulletList()
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- These are conventional nested lists. Word multilevel numbering is provided by classic-numbering.

## Related documentation

- [StarterKit](../../core/starter-kit/README.md)
- [Word numbering](../../classic/numbering/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

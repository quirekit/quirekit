# @quirekit/extension-text-style

English | [简体中文](./README.zh-CN.md)

Provides text color, background, size, font family, subscript, superscript and related styles.

## Installation

```bash
npm install @quirekit/extension-text-style
```

## Usage

Add `TextStyleKit` to Core’s `extensions`. This data-only example also needs `@quirekit/core` and `@quirekit/starter-kit`. Call the same commands from your own toolbar or input handlers.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { TextStyleKit } from '@quirekit/extension-text-style'

const editor = new Editor({
  extensions: [StarterKit, TextStyleKit],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }] },
})
editor.commands.selectAll()
editor.commands.setColor('#2563eb')
console.log(editor.getJSON())
editor.destroy()
```

## Things to know

- TextStyleKit bundles several extensions; Color, FontSize and others can also be installed separately. A font-family value does not download a font.

## Related documentation

- [Core setup](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

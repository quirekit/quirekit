# @quirekit/incremark-core

English | [简体中文](./README.zh-CN.md)

The parsing core behind Markdown readers. It keeps the original text and parser state, including text that is still arriving. Both Vue and React readers use it.

## Installation

```bash
npm install @quirekit/incremark-core
```

## Usage

Use `MarkdownStream` to accumulate text. If you need a visible reader, use the Incremark component for your framework.

```ts
import { MarkdownStream } from '@quirekit/incremark-core'

const stream = new MarkdownStream()
stream.append('# Hello\n\n')
stream.append('A complete paragraph.')
console.log(stream.content)
```

## Things to know

- `append()` receives new text; `update()` receives the full text. Do not confuse the two.
- Long inputs may be parsed in stages. A custom reader must handle `pending` and call `advance()` to continue parsing.

## Related documentation

- [Vue reader](../incremark/README.md)
- [React reader](../incremark-react/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

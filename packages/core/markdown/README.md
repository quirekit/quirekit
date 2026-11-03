# @quirekit/markdown

English | [简体中文](./README.zh-CN.md)

Converts Markdown text to and from QuireKit document JSON for rich-text import, export and processing.

## Installation

```bash
npm install @quirekit/markdown
```

## Usage

Use `parseMarkdown()` and `serializeMarkdown()` directly, or use `MarkdownManager` to combine conversion rules from extensions.

```ts
import { parseMarkdown, serializeMarkdown } from '@quirekit/markdown'

const document = parseMarkdown('Hello **world**')
console.log(serializeMarkdown(document))
```

## Things to know

- Custom nodes need parsing and output rules. Markdown cannot preserve all Word layout information.
- This package converts data. Use MSFE or Md Editor to keep and directly edit Markdown source documents.

## Related documentation

- [Markdown editor](../../md-editor/editor/README.md)
- [Markdown editor engine](../../msfe/core/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/lezer-markdown

English | [简体中文](./README.zh-CN.md)

Parses Markdown text into a tree for editing, positioning and syntax analysis.

## Installation

```bash
npm install @quirekit/lezer-markdown
```

## Usage

parser.parse(text) returns a syntax tree describing source ranges. It does not render HTML; use incremark to display Markdown.

```ts
import { parser } from '@quirekit/lezer-markdown'

const tree = parser.parse('# Hello\n\nA paragraph.\n')
console.log(tree.toString())
```

## Things to know

- A maintained Lezer Markdown version; UPSTREAM.json records its source and local changes.
- MSFE already uses this parser. Ordinary applications need not create a parallel parser.

## Related documentation

- [Reading Markdown](../incremark-core/README.md)
- [Editing Markdown](../msfe/core/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

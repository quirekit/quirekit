# @quirekit/lit-docx-contract

English | [简体中文](./README.zh-CN.md)

Document types, node builders and extension interfaces shared by DOCX-related packages. Extension authors can describe Word content without loading the complete file parser.

## Installation

```bash
npm install @quirekit/lit-docx-contract
```

## Usage

Use `docx` to build content such as paragraphs, or `import type` for document and conversion interfaces. Use Lit DOCX when writing a complete file.

```ts
import { docx } from '@quirekit/lit-docx-contract'

const paragraph = docx.blocks.paragraph({ children: [docx.inline.text('Hello Word')] })
console.log(paragraph)
```

Numbering levels can declare `start: 0`. An instance override uses `start` for the outer `w:startOverride` and optional `levelStart` for an explicit `w:start` in the replacement level. Retaining both roles lets consumers apply their Word compatibility rules without losing source values through field merging.

## Related documentation

- [Read and generate DOCX files](../lit-docx/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

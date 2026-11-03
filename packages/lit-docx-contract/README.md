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

## Related documentation

- [Read and generate DOCX files](../lit-docx/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

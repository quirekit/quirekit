# @quirekit/docx

English | [简体中文](./README.zh-CN.md)

Connects QuireKit editors to DOCX file tools. It collects conversion rules from extensions and maps editor content to and from Word document content.

## Installation

```bash
npm install @quirekit/docx
```

## Usage

Supply a DOCX implementation during application startup, then use the editor’s `docx` service for conversion. This is the runtime registration step; the app must also have access to `@quirekit/lit-docx`.

```ts
import { provideDocxRuntime } from '@quirekit/docx'

provideDocxRuntime(() => import('@quirekit/lit-docx'))
```

## Things to know

- Installing this package alone does not add Word document features or file menus. See Classic DOCX for a complete product setup.
- Custom nodes should declare their DOCX conversion rules and how unsupported content is handled.

## Related documentation

- [Complete Word integration](../../classic-docx/README.md)
- [File I/O implementation](../../lit-docx/README.md)
- [Conversion types and tools](../../lit-docx-contract/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

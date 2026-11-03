# @quirekit/export-template

English | [简体中文](./README.zh-CN.md)

Describes page, font, paragraph and other layout styles for document export. Multiple export formats can share a template.

## Installation

```bash
npm install @quirekit/export-template
```

## Usage

Use `resolveExportTemplate()` to validate settings and fill defaults. This example reads the default template. The library package provides selection UI and storage.

```ts
import { resolveExportTemplate } from '@quirekit/export-template'

const style = resolveExportTemplate()
console.log(style)
```

## Related documentation

- [Template library](../export-template-library/README.md)
- [Markdown file export](../md-editor/export/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

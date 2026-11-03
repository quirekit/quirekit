# @quirekit/text-diagram

English | [简体中文](./README.zh-CN.md)

Manages diagrams written as text, including Mermaid, PlantUML and Graphviz DOT. Stores source code, language and preview information.

## Installation

```bash
npm install @quirekit/text-diagram
```

## Usage

This wraps Mermaid source in a Markdown code fence for storage in a Markdown document.

```ts
import { textDiagramMarkdown } from '@quirekit/text-diagram'

const markdown = textDiagramMarkdown('mermaid', 'graph TD\n  A[Start] --> B[Finish]')
console.log(markdown)
```

## Things to know

- This package stores and validates data. Use Text Diagram Editor to edit code and render a preview.

## Related documentation

- [Text diagram editor](../text-diagram-editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

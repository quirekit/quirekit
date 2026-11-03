# @quirekit/flowchart-pdf

English | [简体中文](./README.zh-CN.md)

Exports flowcharts to PDF for downloading, sharing or printing.

## Installation

```bash
npm install @quirekit/flowchart-pdf
```

## Usage

Encode a flowchart with `encodeFlowchartPdf()`, supplying the required fonts through `provideFlowchartPdfFonts()` first. A complete application can use the export action in Flow Editor.

## Things to know

- Fonts must cover the characters used in the diagram, including Chinese where needed.
- This exports flowcharts. The PDF package handles complete paginated documents.

## Related documentation

- [Flowchart editor](../flow-editor/README.md)
- [Document PDF export](../pdf/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

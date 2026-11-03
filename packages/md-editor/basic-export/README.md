# @quirekit/md-editor-basic-export

English | [简体中文](./README.zh-CN.md)

Open-source basic Word import/export and PDF export for Md Editor. Established open-source libraries do the conversion; this package connects them to the editor's file interfaces.

## Install

```bash
npm install @quirekit/md-editor-basic-export
```

## Usage

Pass `mdBasicDocx()` as the `converter` of MdEditor's `docx` option and add `mdBasicPdfExport()` to `exporters`:

```ts
import { mdBasicDocx, mdBasicPdfExport } from '@quirekit/md-editor-basic-export';

const docx = { converter: mdBasicDocx() };
const exporters = [mdBasicPdfExport()];
```

The libraries load on the first import or export. PDF embeds Noto Sans Hans from `@quirekit/font-pack` by default; pass `mdBasicPdfExport({ fonts })` with URLs or bytes to serve your own fonts.

## Scope

| Direction | Library | Notes |
| --- | --- | --- |
| Markdown → Word | `@mohtasham/md-to-docx` | Native headings, lists, tables, equations and footnotes |
| Word → Markdown | Mammoth and Turndown | Body text, headings, lists, tables, links and images; native Word equations, layout, comments and revisions are not imported |
| Markdown → PDF | pdfmake | Produces PDF bytes in the browser; formulas stay as LaTeX source, footnotes go to the end, italics render upright |

MSFE-specific content is downgraded as follows, and every downgrade is listed in the export report rather than dropped silently:

- containers become blockquotes; note-like containers become Word callouts;
- flowcharts, mind maps and whiteboards with a saved preview export as that image; other embedded blocks become placeholders;
- Mermaid, PlantUML and other text diagrams stay as code;
- the selected export style is not applied; the library's default layout is used.

This package does not export OFD and makes no fidelity guarantee. For faithful import, extension round trips, paginated PDF/OFD and shared export templates, use QuireKit's professional export components.

## Known issue

`@mohtasham/md-to-docx` 4.0.1 writes two paragraph styles on heading paragraphs. Word recognizes them as headings, but reading this package's own export back with the basic importer turns headings into plain paragraphs; files re-saved by Word are not affected.

## License

[MIT](./LICENSE.md); see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). Dependencies `@mohtasham/md-to-docx`, Turndown and pdfmake are MIT, Mammoth is BSD-2-Clause, and the fonts are SIL OFL.

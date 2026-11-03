# @quirekit/classic-paragraph-model

English | [简体中文](./README.zh-CN.md)

Word-compatible paragraph formatting: the data model, schema and editing commands for alignment, indentation, spacing, tab stops, page breaks and column breaks. It contains no DOCX import or export and works in any QuireKit editor.

## Install

```bash
npm install @quirekit/classic-paragraph-model
```

## Usage

Add `WordParagraphNode` and `WordParagraph` to the editor extensions to edit paragraph formatting; functions such as `resolveWordParagraphFormatting` read and resolve formatting. For Word document conversion, use the commercial `@quirekit/classic-paragraph` instead: it contains everything in this package and adds the DOCX codecs.

## Notes

- Install either this package or `@quirekit/classic-paragraph`, never both paragraph extensions at once.

## License

[MIT](./LICENSE.md); third-party notices are in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

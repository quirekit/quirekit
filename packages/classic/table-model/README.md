# @quirekit/classic-table-model

English | [简体中文](./README.zh-CN.md)

Word-compatible tables: the data model and schema for tables, rows and cells; editing commands for inserting and deleting rows and columns, merging and splitting cells, column widths, table styles, sorting and clipboard; and the table layout used by paginated rendering. It contains no DOCX import or export and no revision tracking, and works in any QuireKit editor.

## Install

```bash
npm install @quirekit/classic-table-model
```

## Usage

Spread `WordTableExtensions` into the editor extensions and install `@quirekit/classic-styles-model`. For Word document conversion or tracked changes, use the commercial `@quirekit/classic-table` instead: it contains everything in this package and adds DOCX codecs and revision integration.

## Notes

- Install either this package or `@quirekit/classic-table`, never both sets of table nodes.
- Closed-source products need a QuireKit commercial license.

## License

[MIT](./LICENSE.md); third-party notices are in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

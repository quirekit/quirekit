# @quirekit/classic-numbering-model

English | [简体中文](./README.zh-CN.md)

Word-compatible multi-level list numbering: the data model and editing commands for numbering definitions, levels, renumbering, bullets and list styles. It contains no DOCX import or export and no revision tracking, and works in any QuireKit editor.

## Install

```bash
npm install @quirekit/classic-numbering-model
```

## Usage

Add `WordNumbering` to the editor extensions together with `@quirekit/classic-paragraph-model` and `@quirekit/classic-styles-model`. For Word document conversion or tracked changes, use the commercial `@quirekit/classic-numbering` instead: it contains everything in this package and adds DOCX codecs and revision integration.

## Notes

- Install either this package or `@quirekit/classic-numbering`, never both numbering extensions at once.
- Closed-source products need a QuireKit commercial license.

## License

[MIT](./LICENSE.md); third-party notices are in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

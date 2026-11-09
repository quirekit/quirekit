# @quirekit/classic-numbering-model

English | [简体中文](./README.zh-CN.md)

Word-compatible multi-level list numbering: the data model and editing commands for numbering definitions, levels, renumbering, bullets and list styles. It contains no DOCX import or export and no revision tracking, and works in any QuireKit editor.

## Install

```bash
npm install @quirekit/classic-numbering-model
```

## Usage

Add `WordNumbering` to the editor extensions together with `@quirekit/classic-paragraph-model` and `@quirekit/classic-styles-model`. For Word document conversion or tracked changes, use the commercial `@quirekit/classic-numbering` instead: it contains everything in this package and adds DOCX codecs and revision integration.

Definitions, explicit ordered-list creation and restarts accept zero and advance through 0, 1 and 2. Each numbering format and language keeps its own zero representation; negative starts remain outside the supported range.
Typing `0. ` into an empty paragraph still keeps ordinary text; automatic list input rules are unchanged.

When a multilevel list starts with a child, default ancestor counters take their declared starts and later parent paragraphs continue them. Skipped levels and declared restart triggers follow the same rule, preserving zero. Implicit prefixes of non-root never-restart levels still have recorded interoperability differences.

```ts
editor.commands.toggleWordOrderedList({ start: 0 })
editor.commands.restartWordNumbering({ start: 0 })
```

## Notes

- Install either this package or `@quirekit/classic-numbering`, never both numbering extensions at once.
- Closed-source products need a QuireKit commercial license.

## License

[MIT](./LICENSE.md); third-party notices are in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

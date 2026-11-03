# @quirekit/classic-styles-model

English | [简体中文](./README.zh-CN.md)

Word-compatible named styles: the data model, resolution and editing commands for paragraph styles, character styles, document themes and default fonts. It contains no DOCX import or export and works in any QuireKit editor.

## Install

```bash
npm install @quirekit/classic-styles-model
```

## Usage

Add `WordStyles` to the editor extensions to apply styles such as "Heading 1" and "Normal" and to resolve style inheritance; install `@quirekit/classic-paragraph-model` alongside it for paragraph formatting. For Word document conversion, use the commercial `@quirekit/classic-styles` instead: it contains everything in this package and adds the DOCX codecs.

## Notes

- Install either this package or `@quirekit/classic-styles`, never both style extensions at once.
- Closed-source products need a QuireKit commercial license.

## License

[MIT](./LICENSE.md); third-party notices are in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

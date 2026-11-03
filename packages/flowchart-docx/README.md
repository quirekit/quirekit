# @quirekit/flowchart-docx

English | [简体中文](./README.zh-CN.md)

Includes flowcharts in Word exports while preserving the data needed to edit them again in QuireKit.

## Installation

```bash
npm install @quirekit/flowchart-docx
```

## Usage

Register the conversion rules returned by `createFlowchartDocxCodec()` in the DOCX conversion pipeline. Export needs object data and a displayable preview; import attempts to recover the data saved in the file.

## Things to know

- The preview shown in Word is not a native editable Word object of the same kind. Other applications may discard attached data when resaving the file.
- This package handles one document object. Use Lit DOCX or Classic DOCX to read or generate a complete DOCX file.

## Related documentation

- [Source data](../flowchart/README.md)
- [DOCX file I/O](../lit-docx/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/msfe-data-view

English | [简体中文](./README.zh-CN.md)

Embeds editable data views in Markdown, storing their data in code fences.

## Installation

```bash
npm install @quirekit/msfe-data-view
```

## Usage

Add `MsfeDataView` to MSFE’s extensions and use `data-view-editor` for the editing workspace. Read the current fence when opening it, and write back only after confirmation. MD Editor uses these same interfaces for product integration.

## Things to know

- The fence is saved content; the preview is its display.
- Before applying an asynchronous result, verify that the original document and target are still valid.

## Related documentation

- [Data views workspace](../../data-view-editor/README.md)
- [MSFE lifecycle](../core/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

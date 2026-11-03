# @quirekit/msfe-flowchart

English | [简体中文](./README.zh-CN.md)

Embeds editable flowcharts in Markdown, storing their data in code fences.

## Installation

```bash
npm install @quirekit/msfe-flowchart
```

## Usage

Add `MsfeFlowchart` to MSFE’s extensions and use `flow-editor` for the editing workspace. Read the current fence when opening it, and write back only after confirmation. MD Editor uses these same interfaces for product integration.

## Things to know

- The fence is saved content; the preview is its display.
- Before applying an asynchronous result, verify that the original document and target are still valid.

## Related documentation

- [Flowcharts workspace](../../flow-editor/README.md)
- [MSFE lifecycle](../core/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

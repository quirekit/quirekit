# @quirekit/md-editor-ai

English | [简体中文](./README.zh-CN.md)

Adds an AI side panel to Md Editor for conversations and edits about the current Markdown document.

## Installation

```bash
npm install @quirekit/md-editor-ai@alpha
```

The consuming project also needs: `vue` (^3.5.0).

## Usage

Call `createMdEditorAi()` with the page’s `ownerDocument` and model connection settings. Add its `panel` to MdEditor’s `panels` and its `extensions` to the editor extensions. Call the returned `destroy()` when finished.

## Related documentation

- [Related package](../editor/README.md)

## License

[Commercial license](./LICENSE.md): free for development and evaluation; production use requires a license key. Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

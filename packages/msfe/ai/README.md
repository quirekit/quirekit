# @quirekit/msfe-ai

English | [简体中文](./README.zh-CN.md)

Lets AI tools read and edit MSFE Markdown and displays changes awaiting review.

## Installation

```bash
npm install @quirekit/msfe-ai@alpha
```

## Usage

Install MsfeAi, then create the document API with createMsfeDocumentSdk(editor, options). Options supply document identity and application policy. Connect it to your own agent, or use md-editor-ai for the complete MD Editor assistant UI.

## Things to know

- This package does not connect to a model. Destroy the SDK when closing the document to remove review highlights and subscriptions.

## Related documentation

- [MSFE guide](../core/README.md)
- [MD Editor AI assistant](../../md-editor/ai/README.md)

## License

[Commercial license](./LICENSE.md): free for development and evaluation; production use requires a license key. Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

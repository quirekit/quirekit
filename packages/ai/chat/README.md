# @quirekit/ai-chat

English | [简体中文](./README.zh-CN.md)

An AI chat interface with conversation state, messages, model selection, execution progress and edit review. It can connect to different document editors.

## Installation

```bash
npm install @quirekit/ai-chat@alpha
```

The consuming project also needs: `vue` (^3.5.0).

## Usage

Create a conversation with `createAiChatController()` and mount its interface with `mountAiChatWorkspace()`. Supply a responder for model requests. The creator manages conversation and view lifetimes separately.

## Things to know

- For a complete product setup, start with Classic AI or Md Editor AI. Installing this package does not configure a working model by itself.

## Related documentation

- [Related integration](../assistant/README.md)
- [Markdown editor AI](../../md-editor/ai/README.md)

## License

[Commercial license](./LICENSE.md): free for development and evaluation; production use requires a license key. Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

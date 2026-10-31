# @quirekit/ai-assistant

English | [简体中文](./README.zh-CN.md)

Shared model settings, connections and supporting tools for AI assistants across editor products.

## Installation

```bash
npm install @quirekit/ai-assistant@alpha
```

The consuming project also needs: `vue` (^3.5.0).

## Usage

Manage model settings with `createQuireAiProviderSettings()`, resolve connections with `resolveQuireAiModelConnection()` and connect a responder with `createQuireAiPiResponder()`. Your app supplies model endpoints, credentials and storage.

## Things to know

- For a complete product setup, start with Classic AI or Md Editor AI. Installing this package does not configure a working model by itself.

## Related documentation

- [Related integration](../chat/README.md)
- [Markdown editor AI](../../md-editor/ai/README.md)

## License

[Commercial license](./LICENSE.md): free for development and evaluation; production use requires a license key. Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

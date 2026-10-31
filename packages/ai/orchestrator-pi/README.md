# @quirekit/ai-orchestrator-pi

English | [简体中文](./README.zh-CN.md)

Runs AI requests and tool calls through Pi and connects the results to QuireKit document sessions.

## Installation

```bash
npm install @quirekit/ai-orchestrator-pi@alpha
```

## Usage

Organize document tasks with `createQuireAiPiCoordinator()`. Use `createQuireAiPiDirectRuntime()` for direct model access or `createQuireAiPiHostRuntime()` for a server proxy. Your app supplies connection settings and task permissions.

## Things to know

- For a complete product setup, start with Classic AI or Md Editor AI. Installing this package does not configure a working model by itself.

## Related documentation

- [Related integration](../../../apps/ai-provider-host/README.md)
- [Markdown editor AI](../../md-editor/ai/README.md)

## License

[Commercial license](./LICENSE.md): free for development and evaluation; production use requires a license key. Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/ai-orchestrator-pi

[English](./README.md) | 简体中文

用 Pi 运行 AI 请求和工具调用，并把结果接回 QuireKit 的文档会话。

## 安装

```bash
npm install @quirekit/ai-orchestrator-pi@alpha
```

## 使用方式

用 `createQuireAiPiCoordinator()` 组织文档任务。直连模型使用 `createQuireAiPiDirectRuntime()`，通过服务端代理使用 `createQuireAiPiHostRuntime()`；连接设置和任务权限由应用提供。

## 使用时注意

- 需要完整产品接入时优先使用 Classic AI 或 Md Editor AI；仅安装此包不会自动配置可用模型。

## 相关说明

- [相关接入说明](../../../apps/ai-provider-host/README.zh-CN.md)
- [Markdown 编辑器 AI](../../md-editor/ai/README.zh-CN.md)

## 许可

[商业许可](./LICENSE.md)：开发与评估免费，生产使用需要授权码；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

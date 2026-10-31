# @quirekit/ai-assistant

[English](./README.md) | 简体中文

AI 助手的模型设置、连接和通用配套工具。供不同编辑器共用，不绑定某一种文档产品。

## 安装

```bash
npm install @quirekit/ai-assistant@alpha
```

使用本包还需要：`vue` (^3.5.0)。

## 使用方式

用 `createQuireAiProviderSettings()` 管理模型设置，通过 `resolveQuireAiModelConnection()` 解析连接，再用 `createQuireAiPiResponder()` 接到聊天控制器。模型地址、凭证和存储由应用提供。

## 使用时注意

- 需要完整产品接入时优先使用 Classic AI 或 Md Editor AI；仅安装此包不会自动配置可用模型。

## 相关说明

- [相关接入说明](../chat/README.zh-CN.md)
- [Markdown 编辑器 AI](../../md-editor/ai/README.zh-CN.md)

## 许可

[商业许可](./LICENSE.md)：开发与评估免费，生产使用需要授权码；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

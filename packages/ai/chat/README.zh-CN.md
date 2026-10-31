# @quirekit/ai-chat

[English](./README.md) | 简体中文

带会话状态的 AI 聊天界面。管理消息、模型选择、执行过程和编辑确认，可以接到不同文档编辑器。

## 安装

```bash
npm install @quirekit/ai-chat@alpha
```

使用本包还需要：`vue` (^3.5.0)。

## 使用方式

先用 `createAiChatController()` 创建会话，再用 `mountAiChatWorkspace()` 挂载界面。提供 responder 处理模型请求；会话和界面的生命周期分别由创建方管理。

## 使用时注意

- 需要完整产品接入时优先使用 Classic AI 或 Md Editor AI；仅安装此包不会自动配置可用模型。

## 相关说明

- [相关接入说明](../assistant/README.zh-CN.md)
- [Markdown 编辑器 AI](../../md-editor/ai/README.zh-CN.md)

## 许可

[商业许可](./LICENSE.md)：开发与评估免费，生产使用需要授权码；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

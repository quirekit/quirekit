# @quirekit/ai-runtime

[English](./README.md) | 简体中文

让 AI 读取和修改编辑器文档的核心服务。统一处理文档视图、块定位、编辑工具和错误说明。

## 安装

```bash
npm install @quirekit/ai-runtime@alpha
```

## 使用方式

应用通过编辑器的 AI 服务或公开的 document SDK 调用。扩展用 `addAiCapabilities()` 描述自己可读的内容，并用 `defineCommand` 描述可执行的命令。

## 使用时注意

- 需要完整产品接入时优先使用 Classic AI 或 Md Editor AI；仅安装此包不会自动配置可用模型。

## 相关说明

- [AI 合同（扩展声明能力用的类型）](../contract/README.zh-CN.md)
- [相关接入说明](../../classic-ai/README.zh-CN.md)
- [Markdown 编辑器 AI](../../md-editor/ai/README.zh-CN.md)

## 许可

[商业许可](./LICENSE.md)：开发与评估免费，生产使用需要授权码；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

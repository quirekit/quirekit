# @quirekit/msfe-ai

[English](./README.md) | 简体中文

让 AI 工具读取和修改 MSFE 的 Markdown，并显示等待审阅的改动。

## 安装

```bash
npm install @quirekit/msfe-ai@alpha
```

## 使用方式

安装 MsfeAi 扩展，再用 createMsfeDocumentSdk(editor, options) 创建文档接口。options 提供文档身份和应用策略。该接口可交给自己的 Agent；完整的 MD Editor 助手界面见 md-editor-ai。

## 使用时注意

- 模型连接不属于本包。关闭文档时销毁 SDK，释放审阅高亮和订阅。

## 相关说明

- [MSFE 使用说明](../core/README.zh-CN.md)
- [MD Editor AI 助手](../../md-editor/ai/README.zh-CN.md)

## 许可

[商业许可](./LICENSE.md)：开发与评估免费，生产使用需要授权码；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

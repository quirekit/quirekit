# @quirekit/md-editor-ai

[English](./README.md) | 简体中文

为 Md Editor 提供 AI 侧边面板，让用户围绕当前 Markdown 文档对话和编辑。

## 安装

```bash
npm install @quirekit/md-editor-ai@alpha
```

使用本包还需要：`vue` (^3.5.0)。

## 使用方式

调用 `createMdEditorAi()` 并提供页面的 `ownerDocument` 和模型连接设置。把返回的 `panel` 放进 MdEditor 的 `panels`，把 `extensions` 加进编辑器扩展；退出时调用返回的 `destroy()`。

## 相关说明

- [相关包](../editor/README.zh-CN.md)

## 许可

[商业许可](./LICENSE.md)：开发与评估免费，生产使用需要授权码；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

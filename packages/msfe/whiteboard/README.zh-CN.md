# @quirekit/msfe-whiteboard

[English](./README.md) | 简体中文

在 Markdown 中插入和编辑白板，用代码围栏保存可以再次编辑的数据。

## 安装

```bash
npm install @quirekit/msfe-whiteboard
```

## 使用方式

把 `MsfeWhiteboard` 加入 MSFE 的 extensions，并由 `whiteboard-editor` 提供编辑窗口。打开窗口时读取当前围栏，用户确认后才把新内容写回同一文档。MD Editor 的产品集成可复用这些接口。

## 使用时注意

- 源码围栏是保存内容，页面上的预览只是显示结果。
- 异步编辑完成时应确认原文档和目标仍有效，不把结果写到用户后来切换的文档里。

## 相关说明

- [白板工作区](../../whiteboard-editor/README.zh-CN.md)
- [MSFE 生命周期](../core/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

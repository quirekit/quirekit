# @quirekit/extension-data-view

[English](./README.md) | 简体中文

把多维表格作为一个内容块放进 Core、Block 或 Classic 文档，保存可继续编辑的数据和预览。

## 安装

```bash
npm install @quirekit/extension-data-view
```

## 使用方式

将 `DataView` 加入 Core 的 `extensions`，并用 `data-view-editor` 提供编辑界面。只有这个扩展时，文档能认识这种内容块，但应用仍需接入创建、打开和保存界面。已有产品预设可能已经安装它，添加前先检查预设配置。自定义入口可使用 `openDataView`。

## 使用时注意

- 用户在多维表格窗口里取消时，保留原正文；确认保存后再提交新数据和对应预览。
- 复制内容、撤销和文档保存由外层编辑器负责，图形界面的临时草稿不能替代正文数据。

## 相关说明

- [多维表格编辑界面](../../data-view-editor/README.zh-CN.md)
- [Block Editor 接入](../../block-editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

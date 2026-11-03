# @quirekit/data-view-editor

[English](./README.md) | 简体中文

数据视图的编辑界面。提供独立编辑界面，也能接入文档中的编辑弹窗。

## 安装

```bash
npm install @quirekit/data-view-editor
```

使用本包还需要：`vue` (^3.5.0)。

## 使用方式

用 `openDataViewDialog()` 打开编辑弹窗，传入当前数据，并将确认后的结果写回应用。

## 使用时注意

- 界面样式从 `@quirekit/data-view-editor/styles.css` 引入。
- 确认保存后再替换文档中的内容；取消编辑时保留原内容。保存位置和媒体上传由应用提供。

## 相关说明

- [数据格式与处理](../data-view/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

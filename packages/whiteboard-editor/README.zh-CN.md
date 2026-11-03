# @quirekit/whiteboard-editor

[English](./README.md) | 简体中文

白板的编辑界面。提供独立编辑界面，也能接入文档中的编辑弹窗。

## 安装

```bash
npm install @quirekit/whiteboard-editor
```

## 使用方式

用 `openWhiteboardDialog()` 打开编辑弹窗，传入当前数据，并将确认后的结果写回应用。 Vue 组件 `WhiteboardEditor` 从 `@quirekit/whiteboard-editor/vue` 导入。

## 使用时注意

- 界面样式从 `@quirekit/whiteboard-editor/styles.css` 引入。
- 确认保存后再替换文档中的内容；取消编辑时保留原内容。保存位置和媒体上传由应用提供。

## 相关说明

- [数据格式与处理](../whiteboard/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

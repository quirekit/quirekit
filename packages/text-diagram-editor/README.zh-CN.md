# @quirekit/text-diagram-editor

[English](./README.md) | 简体中文

文字图的编辑界面。编辑文字源码并即时查看图形预览，支持 Mermaid、PlantUML 和 DOT。

## 安装

```bash
npm install @quirekit/text-diagram-editor
```

## 使用方式

用 `openTextDiagramDialog()` 打开编辑弹窗，传入当前数据，并将确认后的结果写回应用。 Vue 组件 `TextDiagramEditor` 从 `@quirekit/text-diagram-editor/vue` 导入。

## 使用时注意

- 界面样式从 `@quirekit/text-diagram-editor/styles.css` 引入。
- 确认保存后再替换文档中的内容；取消编辑时保留原内容。保存位置和媒体上传由应用提供。

## 相关说明

- [数据格式与处理](../text-diagram/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

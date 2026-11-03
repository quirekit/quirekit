# @quirekit/classic-editor

[English](./README.md) | 简体中文

QuireKit 的分页文档编辑器界面，提供工具栏、页面、选区和文档对象的编辑入口。配合 Classic Word 预设，可以编辑带页眉页脚、表格和其他 Word 功能的文档。

## 安装

```bash
npm install @quirekit/classic-editor
```

## 使用方式

使用 `createClassicEditor({ element, preset, plugins })` 在浏览器中挂载。完整的 Word 示例见下方 Classic DOCX 说明；其中 `preset` 决定文档支持哪些内容，`plugins` 增加文件操作等界面功能。

## 使用时注意

- 引入 `@quirekit/classic-editor/styles.css`；Vue 组件从 `@quirekit/classic-editor/vue` 导入。
- 用实例的 `getJSON()` 读取当前文档，结束使用时调用 `destroy()`。
- 保存位置、文件上传和身份认证由应用提供。公开包当前为 alpha，升级时请检查接口变化。

## 相关说明

- [完整 Word 接入示例](../classic-docx/README.zh-CN.md)
- [更多 Word 功能](../classic-pro/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

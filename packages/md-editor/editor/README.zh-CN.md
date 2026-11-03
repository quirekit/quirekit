# @quirekit/md-editor

[English](./README.md) | 简体中文

带工具栏的 Markdown 编辑器。可以在阅读式编辑和源码编辑之间切换，编辑结果仍是 Markdown 文本，适合文章、笔记和 AI 生成内容。

## 安装

```bash
npm install @quirekit/md-editor
```

## 使用方式

下面是 Vue 的最小界面。`markdown` 用作初始内容；后续替换文档和保存内容通过组件暴露的 `editor` 操作。

```vue
<script setup lang="ts">
import { MdEditor } from '@quirekit/md-editor/vue'
import '@quirekit/md-editor/styles.css'

const markdown = '# Hello\n\nStart writing here.'
</script>

<template>
  <MdEditor :markdown="markdown" label="Document" />
</template>
```

## 使用时注意

- `markdown` 不是双向绑定属性。保存时读取 `editor.getMarkdown()`，不要以为改 prop 就会重置当前文档。
- 图片上传通过 `images` 接入应用存储；文档搜索也需要应用提供相应服务。评论与 AI 分别由商业包 `@quirekit/md-editor-comments`、`@quirekit/md-editor-ai` 提供。
- 只需要显示 Markdown 时使用 `MdProse` 或 Incremark；只需要编辑引擎时使用 MSFE。

## 相关说明

- [编辑引擎](../../msfe/core/README.zh-CN.md)
- [Markdown 阅读组件](../../incremark/README.zh-CN.md)
- [AI 面板](../ai/README.zh-CN.md)
- [文件导出](../export/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

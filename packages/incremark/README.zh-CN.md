# @quirekit/incremark

[English](./README.md) | 简体中文

Vue 的 Markdown 阅读组件，既能显示完整文章，也能显示正在逐步收到的 AI 回复。它显示内容，不提供编辑工具栏。

## 安装

```bash
npm install @quirekit/incremark
```

## 使用方式

把完整的当前文本传给 `content`。流式回复每次更新时也传累计文本，不只传最后收到的一段。

```vue
<script setup lang="ts">
import { QuireMarkdown } from '@quirekit/incremark/vue'
import '@quirekit/incremark/styles.css'

const content = '## Hello\n\nThis is **Markdown**.'
</script>

<template>
  <QuireMarkdown :content="content" />
</template>
```

## 使用时注意

- 流式回复使用 `status="receiving"`，完成后改为 `complete`。换一条消息时更换 `identity`，让组件释放上一条消息的资源。
- 普通 Markdown 中的 HTML 不应直接当作可信页面执行；需要 HTML 显示时明确配置处理规则。

## 相关说明

- [React 组件](../incremark-react/README.zh-CN.md)
- [解析与流式状态](../incremark-core/README.zh-CN.md)
- [Markdown 编辑器](../md-editor/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

# @quirekit/md-editor

[English](./README.md) | 简体中文

带工具栏的 Markdown 编辑器。可以在阅读式编辑和源码编辑之间切换，编辑结果仍是 Markdown 文本，适合文章、笔记和 AI 生成内容。

## 安装

```bash
npm install @quirekit/md-editor @quirekit/ui @quirekit/unocss-preset @ark-ui/vue vue
```

## 使用方式

下面是 Vue 的最小界面。`markdown` 用作初始内容；后续替换文档和保存内容通过组件暴露的 `editor` 操作。

```vue
<script setup lang="ts">
import { createTheme, defaultBaseTokens, quireIconRegistry } from '@quirekit/ui'
import { QuireIconProvider, QuireThemeProvider } from '@quirekit/ui/vue'
import { MdEditor } from '@quirekit/md-editor/vue'
import '@quirekit/unocss-preset/quirekit.css'
import '@quirekit/ui/styles.css'
import '@quirekit/md-editor/styles.css'

const theme = createTheme({ profile: 'precision', scheme: 'light', sources: { primary: defaultBaseTokens.color.source.cobalt } })
const markdown = '# Hello\n\nStart writing here.'
</script>

<template>
  <QuireIconProvider :registry="quireIconRegistry">
    <QuireThemeProvider :theme="theme">
      <MdEditor :markdown="markdown" label="Document" />
    </QuireThemeProvider>
  </QuireIconProvider>
</template>
```

## 性能

| 文档 | 视图 | 更新 P50 | P90 | P95 | P99 | 下一帧 P50 | 下一帧 P95 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 KB | 文档 | 4.3 | 4.6 | 5.0 | 5.6 | 11.1 | 12.6 |
| 100 KB | 预览 | 4.5 | 4.9 | 5.0 | 5.7 | 11.5 | 12.8 |
| 100 KB | 源码 | 3.4 | 3.8 | 3.9 | 4.5 | 7.5 | 9.6 |
| 100 万字符 | 文档 | 5.5 | 6.0 | 6.8 | 7.9 | 12.8 | 15.0 |
| 100 万字符 | 预览 | 5.8 | 6.3 | 6.8 | 8.3 | 13.2 | 15.6 |
| 100 万字符 | 源码 | 4.4 | 5.0 | 6.1 | 9.4 | 8.4 | 12.0 |

单位为毫秒，每行在文档中部连续输入 200 次，包含冷启动的输入。测试的是带工具栏和图表的完整 `MdEditor`，文档以长段落为主；测试环境为 Apple M3 Max，Chromium 149。**更新**是从按键到编辑器接受新文档，**下一帧**是从按键到带有新文字的一帧生成完毕。按键通过浏览器自动化协议发送，不包含键盘、操作系统、输入法和显示器的耗时；结构越密集开销越高，不同机器结果也会有差异。

在 QuireKit 仓库中可以自己运行：

```bash
pnpm --filter @quirekit/msfe-docs performance:latency
```

## 使用时注意

- 两个 Provider 和两份样式都必须接入，否则图标显示为空白，深色主题也不生效。已经使用 UnoCSS 的应用可以用 `presetQuireKit()` 代替 `quirekit.css`。
- `markdown` 不是双向绑定属性。保存时读取 `editor.getMarkdown()`，不要以为改 prop 就会重置当前文档。
- 图片上传通过 `images` 接入应用存储；文档搜索也需要应用提供相应服务。评论与 AI 分别由商业包 `@quirekit/md-editor-comments`、`@quirekit/md-editor-ai` 提供。
- 打包成单个脚本时，要内嵌 `@quirekit/text-diagram` 的 `diagram-frame.iife.js`（PlantUML 和 Graphviz 需要），并让白板的动态导入能拿到 `react` 和 `react-dom`。
- 只需要显示 Markdown 时使用 `MdProse` 或 Incremark；只需要编辑引擎时使用 MSFE。

## 相关说明

- [编辑引擎](../../msfe/core/README.zh-CN.md)
- [Markdown 阅读组件](../../incremark/README.zh-CN.md)
- [AI 面板](../ai/README.zh-CN.md)
- [文件导出](../export/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

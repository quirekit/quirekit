# @quirekit/incremark-react

[English](./README.md) | 简体中文

Incremark 的 React 阅读组件，用来显示 Markdown 文章或流式 AI 回复。和 Vue 版本使用同一套 Markdown 解析规则。

## 安装

```bash
npm install @quirekit/incremark-react
```

使用本包还需要：`react` (^19.3.0), `react-dom` (^19.3.0)。

## 使用方式

在 React 页面中传入当前的完整 Markdown 文本。

```tsx
import { QuireMarkdown } from '@quirekit/incremark-react'
import '@quirekit/incremark-react/styles.css'

export default function Article() {
  return <QuireMarkdown content={'# Hello\n\nThis is **Markdown**.'} />
}
```

## 使用时注意

- 流式更新传累计文本，并设置 `status`；新消息使用新的 `identity`。
- 组件用于阅读。需要可编辑的 Markdown 文档时使用 MSFE React。

## 相关说明

- [解析核心](../incremark-core/README.zh-CN.md)
- [React 编辑器](../msfe/react/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

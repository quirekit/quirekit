# @quirekit/incremark-core

[English](./README.md) | 简体中文

Markdown 阅读功能的解析核心。保存原始文本和解析状态，支持不断追加内容；Vue 和 React 阅读组件都使用它。

## 安装

```bash
npm install @quirekit/incremark-core
```

## 使用方式

使用 `MarkdownStream` 累积文本。需要界面时，直接使用对应框架的 Incremark 组件。

```ts
import { MarkdownStream } from '@quirekit/incremark-core'

const stream = new MarkdownStream()
stream.append('# Hello\n\n')
stream.append('A complete paragraph.')
console.log(stream.content)
```

## 使用时注意

- `append()` 接收新增文本，`update()` 接收完整文本；两者不要混用。
- 长文本解析可能分批完成。自建界面需要处理 `pending`，并通过 `advance()` 继续解析。

## 相关说明

- [Vue 阅读组件](../incremark/README.zh-CN.md)
- [React 阅读组件](../incremark-react/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

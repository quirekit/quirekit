# @quirekit/lezer-markdown

[English](./README.md) | 简体中文

解析 Markdown 文字，生成可用于编辑、定位和语法分析的树。

## 安装

```bash
npm install @quirekit/lezer-markdown
```

## 使用方式

parser.parse(text) 返回语法树。它描述源码范围，不会生成 HTML；如果只想展示 Markdown，请使用 incremark。

```ts
import { parser } from '@quirekit/lezer-markdown'

const tree = parser.parse('# Hello\n\nA paragraph.\n')
console.log(tree.toString())
```

## 使用时注意

- 来自 Lezer Markdown 的维护版本，来源与本地改动见 UPSTREAM.json。
- MSFE 已使用本包；一般应用无需再次创建自己的并行解析器。

## 相关说明

- [读取与展示 Markdown](../incremark-core/README.zh-CN.md)
- [编辑 Markdown](../msfe/core/README.zh-CN.md)

## 许可

[MIT](./LICENSE)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

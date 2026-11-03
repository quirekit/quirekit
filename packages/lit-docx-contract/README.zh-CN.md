# @quirekit/lit-docx-contract

[English](./README.md) | 简体中文

DOCX 相关包共用的文档类型、节点构造工具和扩展接口。扩展作者可以用它描述 Word 内容，而不必同时加载整个文件解析器。

## 安装

```bash
npm install @quirekit/lit-docx-contract
```

## 使用方式

使用 `docx` 构造段落等内容，或用 `import type` 引入文档与转换接口。写出实际文件时再使用 Lit DOCX。

```ts
import { docx } from '@quirekit/lit-docx-contract'

const paragraph = docx.blocks.paragraph({ children: [docx.inline.text('Hello Word')] })
console.log(paragraph)
```

## 相关说明

- [读取与生成 DOCX 文件](../lit-docx/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

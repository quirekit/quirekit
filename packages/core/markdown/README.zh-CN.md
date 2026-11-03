# @quirekit/markdown

[English](./README.md) | 简体中文

在 Markdown 文本和 QuireKit 文档 JSON 之间转换，供富文本编辑器导入、导出或处理 Markdown。

## 安装

```bash
npm install @quirekit/markdown
```

## 使用方式

直接使用 `parseMarkdown()` 和 `serializeMarkdown()`，或者通过 `MarkdownManager` 组合扩展的转换规则。

```ts
import { parseMarkdown, serializeMarkdown } from '@quirekit/markdown'

const document = parseMarkdown('Hello **world**')
console.log(serializeMarkdown(document))
```

## 使用时注意

- 自定义节点需要自己的解析和输出规则，不能假定 Markdown 能保存全部 Word 排版信息。
- 本包转换数据。需要保留并直接编辑 Markdown 源文档时使用 MSFE 或 Md Editor。

## 相关说明

- [Markdown 编辑器](../../md-editor/editor/README.zh-CN.md)
- [Markdown 编辑引擎](../../msfe/core/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

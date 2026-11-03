# @quirekit/text-diagram

[English](./README.md) | 简体中文

管理用文字写出的图，例如 Mermaid 流程图、PlantUML 和 Graphviz DOT。保存源代码、语言和预览信息。

## 安装

```bash
npm install @quirekit/text-diagram
```

## 使用方式

下面把 Mermaid 源码包成 Markdown 代码块，便于保存到 Markdown 文档。

```ts
import { textDiagramMarkdown } from '@quirekit/text-diagram'

const markdown = textDiagramMarkdown('mermaid', 'graph TD\n  A[Start] --> B[Finish]')
console.log(markdown)
```

## 使用时注意

- 本包保存和检查数据。编辑代码及生成图形预览使用 Text Diagram Editor。

## 相关说明

- [文字图编辑器](../text-diagram-editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

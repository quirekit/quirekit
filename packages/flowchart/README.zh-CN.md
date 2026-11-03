# @quirekit/flowchart

[English](./README.md) | 简体中文

流程图的数据工具：创建节点和连线、检查数据、保存 JSON，以及管理编辑草稿。不依赖具体的绘图界面。

## 安装

```bash
npm install @quirekit/flowchart
```

## 使用方式

示例还需安装 `uuid`。实际保存时保留生成的 ID，不要每次读取文档都重新创建。

```ts
import { createFlowchart, createFlowchartNode, serializeFlowchart } from '@quirekit/flowchart'
import { v4 as uuid } from 'uuid'

const chart = createFlowchart()
const node = createFlowchartNode(uuid(), 'process', { x: 40, y: 40 }, 'Review')
const source = serializeFlowchart({ ...chart, nodes: [node] })
console.log(source)
```

## 相关说明

- [流程图编辑界面](../flow-editor/README.zh-CN.md)
- [Word 文件转换](../flowchart-docx/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

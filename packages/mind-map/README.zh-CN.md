# @quirekit/mind-map

[English](./README.md) | 简体中文

思维导图的数据工具。可以从树状大纲创建导图，修改主题和布局，并保存可继续编辑的文档。

## 安装

```bash
npm install @quirekit/mind-map
```

## 使用方式

下面创建一个有两个分支的导图并保存为文本。

```ts
import { createMindMapDocument, serializeMindMap } from '@quirekit/mind-map'

const map = createMindMapDocument({
  text: 'Project',
  children: [
    { text: 'Research', children: [] },
    { text: 'Delivery', children: [] },
  ],
})
console.log(serializeMindMap(map))
```

## 相关说明

- [思维导图编辑界面](../mind-editor/README.zh-CN.md)
- [Word 文件转换](../mind-map-docx/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

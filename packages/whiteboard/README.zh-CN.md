# @quirekit/whiteboard

[English](./README.md) | 简体中文

白板的数据格式和保存工具。记录白板场景及其预览，供独立白板编辑器和文档里的白板使用。

## 安装

```bash
npm install @quirekit/whiteboard
```

## 使用方式

示例还需安装 `uuid`。实际保存时保留生成的 ID，不要每次读取文档都重新创建。

```ts
import { createWhiteboardDocument, serializeWhiteboard } from '@quirekit/whiteboard'
import { v4 as uuid } from 'uuid'

const board = createWhiteboardDocument(uuid(), 'Project ideas')
console.log(serializeWhiteboard(board))
```

## 使用时注意

- 新建空白文档不等于生成预览图片。编辑器保存时应一并更新场景和预览。

## 相关说明

- [白板编辑界面](../whiteboard-editor/README.zh-CN.md)
- [Word 文件转换](../whiteboard-docx/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

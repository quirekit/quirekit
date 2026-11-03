# @quirekit/extension-document

[English](./README.md) | 简体中文

定义文档最外层的 doc 节点，让段落、标题和其他块能组成一篇文档。

## 安装

```bash
npm install @quirekit/extension-document
```

## 使用方式

将 `Document` 放入 Core 编辑器的 `extensions`。StarterKit 默认已包含文档根节点；下面先关闭预设中的同名功能，再单独安装，避免重复。示例只操作文档数据，不挂载界面，需另装 `@quirekit/core` 和 `@quirekit/starter-kit`。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Document } from '@quirekit/extension-document'

const editor = new Editor({
  extensions: [StarterKit.configure({ document: false }), Document],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- Document 本身不提供正文节点，最小编辑器还需要 Paragraph 和 Text。
- 需要可输入的界面时，再选择 DOM View、View 或产品编辑器。

## 相关说明

- [基础扩展集](../../core/starter-kit/README.zh-CN.md)
- [创建编辑器](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

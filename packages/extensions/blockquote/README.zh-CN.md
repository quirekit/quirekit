# @quirekit/extension-blockquote

[English](./README.md) | 简体中文

把一段或多段文字设为引用块，适合摘录、引文和说明。

## 安装

```bash
npm install @quirekit/extension-blockquote
```

## 使用方式

将 `Blockquote` 放入 Core 编辑器的 `extensions`。StarterKit 默认已包含引用块；下面先关闭预设中的同名功能，再单独安装，避免重复。示例只操作文档数据，不挂载界面，需另装 `@quirekit/core` 和 `@quirekit/starter-kit`。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Blockquote } from '@quirekit/extension-blockquote'

const editor = new Editor({
  extensions: [StarterKit.configure({ blockquote: false }), Blockquote],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.toggleBlockquote()
console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- 引用块是文档结构，引用来源和署名由应用自己保存。
- 需要可输入的界面时，再选择 DOM View、View 或产品编辑器。

## 相关说明

- [基础扩展集](../../core/starter-kit/README.zh-CN.md)
- [创建编辑器](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

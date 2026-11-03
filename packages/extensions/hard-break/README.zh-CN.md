# @quirekit/extension-hard-break

[English](./README.md) | 简体中文

在同一段落内插入换行，用于地址、诗歌等不希望另起一段的内容。

## 安装

```bash
npm install @quirekit/extension-hard-break
```

## 使用方式

将 `HardBreak` 放入 Core 编辑器的 `extensions`。StarterKit 默认已包含段内换行；下面先关闭预设中的同名功能，再单独安装，避免重复。示例只操作文档数据，不挂载界面，需另装 `@quirekit/core` 和 `@quirekit/starter-kit`。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { HardBreak } from '@quirekit/extension-hard-break'

const editor = new Editor({
  extensions: [StarterKit.configure({ hardBreak: false }), HardBreak],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.setHardBreak()
console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- 段内换行不同于新段落，也不同于分页符。
- 需要可输入的界面时，再选择 DOM View、View 或产品编辑器。

## 相关说明

- [基础扩展集](../../core/starter-kit/README.zh-CN.md)
- [创建编辑器](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

# @quirekit/extension-strike

[English](./README.md) | 简体中文

给文字加一条删除线，用于表示已完成或不再采用的内容。

## 安装

```bash
npm install @quirekit/extension-strike
```

## 使用方式

将 `Strike` 放入 Core 编辑器的 `extensions`。StarterKit 默认已包含删除线；下面先关闭预设中的同名功能，再单独安装，避免重复。示例只操作文档数据，不挂载界面，需另装 `@quirekit/core` 和 `@quirekit/starter-kit`。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Strike } from '@quirekit/extension-strike'

const editor = new Editor({
  extensions: [StarterKit.configure({ strike: false }), Strike],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.selectAll()
editor.commands.toggleStrike()
console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- 删除线只改变格式，不删除文字，也不表示 Word 修订中的删除记录。
- 需要可输入的界面时，再选择 DOM View、View 或产品编辑器。

## 相关说明

- [基础扩展集](../../core/starter-kit/README.zh-CN.md)
- [创建编辑器](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

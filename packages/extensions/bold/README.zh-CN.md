# @quirekit/extension-bold

[English](./README.md) | 简体中文

为文字加粗，提供设置、取消和切换粗体的命令。

## 安装

```bash
npm install @quirekit/extension-bold
```

## 使用方式

将 `Bold` 放入 Core 编辑器的 `extensions`。StarterKit 默认已包含粗体；下面先关闭预设中的同名功能，再单独安装，避免重复。示例只操作文档数据，不挂载界面，需另装 `@quirekit/core` 和 `@quirekit/starter-kit`。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Bold } from '@quirekit/extension-bold'

const editor = new Editor({
  extensions: [StarterKit.configure({ bold: false }), Bold],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.selectAll()
editor.commands.toggleBold()
console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- 只影响选中文字或之后输入的文字，不添加工具栏。
- 需要可输入的界面时，再选择 DOM View、View 或产品编辑器。

## 相关说明

- [基础扩展集](../../core/starter-kit/README.zh-CN.md)
- [创建编辑器](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

# @quirekit/extension-code

[English](./README.md) | 简体中文

把句子中的一小段文字标记为代码，例如函数名或命令名。

## 安装

```bash
npm install @quirekit/extension-code
```

## 使用方式

将 `Code` 放入 Core 编辑器的 `extensions`。StarterKit 默认已包含行内代码；下面先关闭预设中的同名功能，再单独安装，避免重复。示例只操作文档数据，不挂载界面，需另装 `@quirekit/core` 和 `@quirekit/starter-kit`。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Code } from '@quirekit/extension-code'

const editor = new Editor({
  extensions: [StarterKit.configure({ code: false }), Code],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.selectAll()
editor.commands.toggleCode()
console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- 多行源码请使用 extension-code-block；本包不会运行代码。
- 需要可输入的界面时，再选择 DOM View、View 或产品编辑器。

## 相关说明

- [基础扩展集](../../core/starter-kit/README.zh-CN.md)
- [创建编辑器](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

# @quirekit/extension-code-block

[English](./README.md) | 简体中文

在文档中保存多行代码，支持语言属性和代码围栏输入。

## 安装

```bash
npm install @quirekit/extension-code-block
```

## 使用方式

将 `CodeBlock` 放入 Core 编辑器的 `extensions`。StarterKit 默认已包含代码块；下面先关闭预设中的同名功能，再单独安装，避免重复。示例只操作文档数据，不挂载界面，需另装 `@quirekit/core` 和 `@quirekit/starter-kit`。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { CodeBlock } from '@quirekit/extension-code-block'

const editor = new Editor({
  extensions: [StarterKit.configure({ codeBlock: false }), CodeBlock],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.setCodeBlock({ language: 'javascript' })
console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- 语言属性用于标记代码语言；语法高亮和运行代码需要应用另行接入。
- 需要可输入的界面时，再选择 DOM View、View 或产品编辑器。

## 相关说明

- [基础扩展集](../../core/starter-kit/README.zh-CN.md)
- [创建编辑器](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

# @quirekit/extension-paragraph

[English](./README.md) | 简体中文

定义普通段落节点，支持 HTML 的 `<p>` 标签。可以用 Core 的 `setNode` 命令把当前文本块改成段落。

## 安装

```bash
npm install @quirekit/extension-paragraph
```

## 使用方式

将 `Paragraph` 放入 Core 编辑器的 `extensions`。StarterKit 默认已包含段落；下面先关闭预设中的同名功能，再单独安装，避免重复。示例只操作文档数据，不挂载界面，需另装 `@quirekit/core` 和 `@quirekit/starter-kit`。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Paragraph } from '@quirekit/extension-paragraph'

const editor = new Editor({
  extensions: [StarterKit.configure({ paragraph: false }), Paragraph],
  content: {
    type: 'doc',
    content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

editor.commands.setNode('paragraph')
console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- 这是通用段落；需要 Word 的缩进、制表位等完整设置时，使用 classic-paragraph。
- 需要可输入的界面时，再选择 DOM View、View 或产品编辑器。

## 相关说明

- [基础扩展集](../../core/starter-kit/README.zh-CN.md)
- [创建编辑器](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

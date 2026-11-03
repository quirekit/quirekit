# @quirekit/extension-text-style

[English](./README.md) | 简体中文

为文字提供颜色、背景色、字号、字体、上下标等样式。

## 安装

```bash
npm install @quirekit/extension-text-style
```

## 使用方式

把 `TextStyleKit` 加入 Core 的 `extensions`。以下示例只处理数据，需另装 `@quirekit/core` 和 `@quirekit/starter-kit`；可在自己的工具栏或输入框事件中调用同样的命令。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { TextStyleKit } from '@quirekit/extension-text-style'

const editor = new Editor({
  extensions: [StarterKit, TextStyleKit],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }] },
})
editor.commands.selectAll()
editor.commands.setColor('#2563eb')
console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- TextStyleKit 组合多种样式扩展，也可单独安装 Color、FontSize 等。设置字体名称不会自动下载字体。

## 相关说明

- [Core 接入](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

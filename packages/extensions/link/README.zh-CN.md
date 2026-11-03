# @quirekit/extension-link

[English](./README.md) | 简体中文

为文字添加可点击的网址，提供插入、修改、取消链接和地址校验。

## 安装

```bash
npm install @quirekit/extension-link
```

## 使用方式

把 `Link` 加入 Core 的 `extensions`。以下示例只处理数据，需另装 `@quirekit/core` 和 `@quirekit/starter-kit`；可在自己的工具栏或输入框事件中调用同样的命令。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Link } from '@quirekit/extension-link'

const editor = new Editor({
  extensions: [StarterKit, Link],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }] },
})
editor.commands.selectAll()
editor.commands.setLink({ href: 'https://example.com' })
console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- 打开链接和保存文档是两件事。应用需要决定是否允许导航，以及在当前页还是新页面打开。

## 相关说明

- [Core 接入](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

# @quirekit/extension-search

[English](./README.md) | 简体中文

在文档中查找文字、切换匹配项并执行替换；查找框由应用自己提供。

## 安装

```bash
npm install @quirekit/extension-search
```

## 使用方式

把 `Search` 加入 Core 的 `extensions`。以下示例只处理数据，需另装 `@quirekit/core` 和 `@quirekit/starter-kit`；可在自己的工具栏或输入框事件中调用同样的命令。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { Search } from '@quirekit/extension-search'

const editor = new Editor({
  extensions: [StarterKit, Search],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }] },
})
editor.commands.setSearchQuery('QuireKit')
console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- 当前查询和高亮不是文档正文，保存文档时不应把它们当作内容。

## 相关说明

- [Core 接入](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

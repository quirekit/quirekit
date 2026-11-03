# @quirekit/extension-list

[English](./README.md) | 简体中文

提供项目符号列表、有序列表、列表项和相应的键盘操作。

## 安装

```bash
npm install @quirekit/extension-list
```

## 使用方式

StarterKit 已包含这些功能。自行组合时可以用 ListKit 一次装入，或者选择 BulletList、OrderedList、ListItem 和 ListKeymap。下面在现有 Core 编辑器配置中替换预设列表；需另装 core 和 starter-kit。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { ListKit } from '@quirekit/extension-list'

const editor = new Editor({
  extensions: [
    StarterKit.configure({ bulletList: false, orderedList: false, listItem: false, listKeymap: false }),
    ListKit,
  ],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First item' }] }] },
})
editor.commands.toggleBulletList()
console.log(editor.getJSON())
editor.destroy()
```

## 使用时注意

- 这是常见的嵌套列表结构。Word 的多级自动编号由 classic-numbering 提供。

## 相关说明

- [基础扩展集](../../core/starter-kit/README.zh-CN.md)
- [Word 自动编号](../../classic/numbering/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

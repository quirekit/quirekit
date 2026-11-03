# @quirekit/dom-view

[English](./README.md) | 简体中文

把 QuireKit 文档放进传统的浏览器 DOM 编辑区。适合需要 contenteditable 编辑体验的应用，也可以用于对比不同渲染方式的行为。

## 安装

```bash
npm install @quirekit/dom-view
```

## 使用方式

先安装 `@quirekit/core` 和 `@quirekit/starter-kit`，然后在浏览器中创建编辑器。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { DomViewExtension } from '@quirekit/dom-view'

const element = document.createElement('div')
document.body.append(element)
const editor = new Editor({
  element,
  mode: 'dom',
  extensions: [StarterKit, DomViewExtension],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
})
console.log(editor.getJSON())
```

## 使用时注意

- 页面退出时调用 `editor.destroy()`。
- DOM 编辑区不提供 Word 分页效果；需要分页文档界面时使用 Classic。

## 相关说明

- [编辑器核心](../core/editor/README.zh-CN.md)
- [分页编辑器](../classic-editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

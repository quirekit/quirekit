# @quirekit/block-editor

[English](./README.md) | 简体中文

面向网页文档的块编辑器。可以编辑段落、列表、图片和嵌入内容，适合笔记、知识库和工作文档。内容用 QuireKit JSON 保存。

## 安装

```bash
npm install @quirekit/block-editor
```

## 使用方式

下面在浏览器中创建一个编辑区域。若需要标题栏、工具栏和块菜单，使用 `@quirekit/block-editor/vue` 的 `BlockEditor`，传入同一个 `instance` 和 `title`。

```ts
import { createBlockEditor } from '@quirekit/block-editor'
import '@quirekit/block-editor/styles.css'

const element = document.createElement('div')
document.body.append(element)
const instance = createBlockEditor({
  element,
  locale: 'zh-CN', // 也支持 en
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
})
instance.setLocale('en') // 只切换界面，保留正文、选区和撤销记录
console.log(instance.editor.getJSON())
```

## 使用时注意

- 页面退出时调用 `instance.destroy()`。只想暂时移除界面时调用 `unmount()`，之后可以重新 `mount(element)`。
- 编辑器不内置保存按钮或自动保存；应用通过 Core 内容与事件接口管理 JSON、标题和存储。Vue 界面保留显式文件导入导出。
- 界面默认中文，支持 `locale: 'en'`、`instance.setLocale()` 与 `instance.onLocaleChange()`；Vue 界面的语言按钮同步公共组件和扩展工具槽，正文不会被翻译。
- 需要 Markdown 源文档时选 Md Editor；需要 Word 页面设置和 DOCX 工作流时选 Classic。

## 相关说明

- [Markdown 编辑器](../md-editor/editor/README.zh-CN.md)
- [Classic 编辑器](../classic-editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

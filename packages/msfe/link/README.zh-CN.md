# @quirekit/msfe-link

[English](./README.md) | 简体中文

识别 Markdown 链接，提供插入、修改以及打开链接的工具。

## 安装

```bash
npm install @quirekit/msfe-link
```

## 使用方式

MSFE StarterKit 默认已包含本功能。以下浏览器示例展示如何明确替换 `link` 配置，方便后续增加自定义选项；需另装 msfe-core 和 msfe-starter-kit。

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { Link } from '@quirekit/msfe-link'

const parent = document.createElement('div')
document.body.append(parent)
const editor = createMsfeEditor({
  parent,
  documentId: 'example',
  markdown: "[Example](https://example.com)",
  mode: 'live',
  extensions: [StarterKit.configure({ link: Link })],
})
console.log(editor.getMarkdown())
// 页面退出时调用 editor.destroy()。
```

## 使用时注意

- 打开网址由应用决定；显示链接卡片不会自动改变原来的 Markdown。
- 销毁编辑器时调用 editor.destroy()，保存时读取 editor.getMarkdown()。

## 相关说明

- [MSFE 接入与保存](../core/README.zh-CN.md)
- [默认扩展配置](../starter-kit/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

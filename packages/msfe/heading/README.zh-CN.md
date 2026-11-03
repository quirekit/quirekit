# @quirekit/msfe-heading

[English](./README.md) | 简体中文

识别 Markdown 标题，提供标题级别编辑和标题导航。

## 安装

```bash
npm install @quirekit/msfe-heading
```

## 使用方式

MSFE StarterKit 默认已包含本功能。以下浏览器示例展示如何明确替换 `heading` 配置，方便后续增加自定义选项；需另装 msfe-core 和 msfe-starter-kit。

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { Heading } from '@quirekit/msfe-heading'

const parent = document.createElement('div')
document.body.append(parent)
const editor = createMsfeEditor({
  parent,
  documentId: 'example',
  markdown: "# Hello",
  mode: 'live',
  extensions: [StarterKit.configure({ heading: Heading })],
})
editor.commands.setHeading(2)
console.log(editor.getMarkdown())
// 页面退出时调用 editor.destroy()。
```

## 使用时注意

- 标题级别通过改写 Markdown 前缀保存；应用可用自己的目录或标题控件调用命令。
- 销毁编辑器时调用 editor.destroy()，保存时读取 editor.getMarkdown()。

## 相关说明

- [MSFE 接入与保存](../core/README.zh-CN.md)
- [默认扩展配置](../starter-kit/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

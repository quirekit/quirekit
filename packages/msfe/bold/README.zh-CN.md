# @quirekit/msfe-bold

[English](./README.md) | 简体中文

识别 Markdown 的粗体标记，并提供切换粗体的编辑命令。

## 安装

```bash
npm install @quirekit/msfe-bold
```

## 使用方式

MSFE StarterKit 默认已包含本功能。以下浏览器示例展示如何明确替换 `bold` 配置，方便后续增加自定义选项；需另装 msfe-core 和 msfe-starter-kit。

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { Bold } from '@quirekit/msfe-bold'

const parent = document.createElement('div')
document.body.append(parent)
const editor = createMsfeEditor({
  parent,
  documentId: 'example',
  markdown: "**Hello** Markdown",
  mode: 'live',
  extensions: [StarterKit.configure({ bold: Bold })],
})
editor.commands.toggleBold()
console.log(editor.getMarkdown())
// 页面退出时调用 editor.destroy()。
```

## 使用时注意

- 文字仍以 **这样的源码** 保存。它不是富文本 Core 的 Bold 扩展。
- 销毁编辑器时调用 editor.destroy()，保存时读取 editor.getMarkdown()。

## 相关说明

- [MSFE 接入与保存](../core/README.zh-CN.md)
- [默认扩展配置](../starter-kit/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

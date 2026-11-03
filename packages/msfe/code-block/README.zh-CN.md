# @quirekit/msfe-code-block

[English](./README.md) | 简体中文

识别 Markdown 代码围栏，显示语言并支持修改代码语言。

## 安装

```bash
npm install @quirekit/msfe-code-block
```

## 使用方式

MSFE StarterKit 默认已包含本功能。以下浏览器示例展示如何明确替换 `codeBlock` 配置，方便后续增加自定义选项；需另装 msfe-core 和 msfe-starter-kit。

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { CodeBlock } from '@quirekit/msfe-code-block'

const parent = document.createElement('div')
document.body.append(parent)
const editor = createMsfeEditor({
  parent,
  documentId: 'example',
  markdown: "```javascript\nconst answer = 42\n```",
  mode: 'live',
  extensions: [StarterKit.configure({ codeBlock: CodeBlock })],
})
console.log(editor.getMarkdown())
// 页面退出时调用 editor.destroy()。
```

## 使用时注意

- 代码内容仍保存在围栏里；本包不会执行代码。
- 销毁编辑器时调用 editor.destroy()，保存时读取 editor.getMarkdown()。

## 相关说明

- [MSFE 接入与保存](../core/README.zh-CN.md)
- [默认扩展配置](../starter-kit/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

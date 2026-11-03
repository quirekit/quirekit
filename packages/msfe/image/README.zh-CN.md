# @quirekit/msfe-image

[English](./README.md) | 简体中文

识别 Markdown 图片，并为图片显示、粘贴和上传提供接入点。

## 安装

```bash
npm install @quirekit/msfe-image
```

## 使用方式

MSFE StarterKit 默认已包含本功能。以下浏览器示例展示如何明确替换 `image` 配置，方便后续增加自定义选项；需另装 msfe-core 和 msfe-starter-kit。

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { Image } from '@quirekit/msfe-image'

const parent = document.createElement('div')
document.body.append(parent)
const editor = createMsfeEditor({
  parent,
  documentId: 'example',
  markdown: "# Pictures",
  mode: 'live',
  extensions: [StarterKit.configure({ image: Image })],
})
console.log(editor.getMarkdown())
// 页面退出时调用 editor.destroy()。
```

## 使用时注意

- 需要上传到服务器时，用 `Image.configure({ upload })` 提供 `ImageUploader`；用 `resolve` 将文档地址转为显示地址。
- 销毁编辑器时调用 editor.destroy()，保存时读取 editor.getMarkdown()。

## 相关说明

- [MSFE 接入与保存](../core/README.zh-CN.md)
- [默认扩展配置](../starter-kit/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

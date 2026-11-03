# @quirekit/html

[English](./README.md) | 简体中文

在 HTML 和 QuireKit 文档 JSON 之间转换。转换使用你安装的文档扩展，因此输出只包含这些扩展认识的节点和格式。

## 安装

```bash
npm install @quirekit/html
```

## 使用方式

下面的示例运行在浏览器，还需安装 `@quirekit/starter-kit`。

```ts
import { generateHTML, generateJSON } from '@quirekit/html'
import { StarterKit } from '@quirekit/starter-kit'

const content = generateJSON('<p>Hello <strong>world</strong></p>', [StarterKit])
console.log(generateHTML(content, [StarterKit]))
```

## 使用时注意

- Node 环境使用 `/server` 入口；它会为本次转换创建并释放服务端 DOM。
- HTML 转换不是网页执行器；需要运行 HTML 示例时使用 HTML Sandbox。

## 相关说明

- [文档核心](../editor/README.zh-CN.md)
- [HTML 预览运行器](../../html-sandbox/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

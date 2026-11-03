# @quirekit/docx

[English](./README.md) | 简体中文

连接 QuireKit 编辑器和 DOCX 文件读写工具。收集扩展提供的转换规则，把编辑器文档与 Word 文件中的内容对应起来。

## 安装

```bash
npm install @quirekit/docx
```

## 使用方式

在应用启动时提供 DOCX 读写实现，然后通过编辑器的 `docx` 服务执行转换。下面是运行时注册步骤；应用还需能访问 `@quirekit/lit-docx`。

```ts
import { provideDocxRuntime } from '@quirekit/docx'

provideDocxRuntime(() => import('@quirekit/lit-docx'))
```

## 使用时注意

- 只安装本包不会自动包含 Word 文档功能和文件菜单。完整产品接入见 Classic DOCX。
- 自定义节点应声明自己的 DOCX 转换规则，并明确不支持内容的处理方式。

## 相关说明

- [完整 Word 接入](../../classic-docx/README.zh-CN.md)
- [文件读写实现](../../lit-docx/README.zh-CN.md)
- [转换类型与工具](../../lit-docx-contract/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

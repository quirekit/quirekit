# @quirekit/devtools

[English](./README.md) | 简体中文

查看编辑器状态、交互记录和渲染信息，帮助定位编辑过程中出现的问题。

## 安装

```bash
npm install @quirekit/devtools
```

## 使用方式

下面给一个不挂载界面的 Core 编辑器安装记录功能；还需安装 `@quirekit/core` 和 `@quirekit/starter-kit`。浏览器中可另外调用 `mountPanel(element)` 显示调试面板。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { createQuireDevtools } from '@quirekit/devtools'

const tools = createQuireDevtools()
const editor = new Editor({ extensions: [StarterKit, tools.extension()] })
console.log(tools.getSnapshot())
editor.destroy()
tools.destroy()
```

## 使用时注意

- 只在需要诊断的环境启用。导出诊断信息前检查其中是否包含用户文档内容。

## 相关说明

- [编辑器核心](../../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

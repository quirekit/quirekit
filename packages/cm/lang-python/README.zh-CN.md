# @quirekit/cm-lang-python

[English](./README.md) | 简体中文

为 CodeMirror 编辑器添加 Python 语法支持。

## 安装

```bash
npm install @quirekit/cm-lang-python
```

## 使用方式

调用 `python()` 得到一个语言扩展，再放入 CodeMirror 的 extensions。下面先创建编辑状态；需要界面时把该状态交给 cm-view。示例另需安装 cm-state。

```ts
import { EditorState } from '@quirekit/cm-state'
import { python } from '@quirekit/cm-lang-python'

const state = EditorState.create({
  doc: "print(\"Hello\")",
  extensions: [python()],
})
console.log(state.doc.toString())
```

## 使用时注意

- 语法支持不执行源码。
- 同一编辑器中的 state、view、语言扩展都应来自 @quirekit/cm-*，避免和官方 @codemirror/* 混用。

## 相关说明

- [挂载代码编辑器](../view/README.zh-CN.md)
- [Markdown 编辑器](../../msfe/core/README.zh-CN.md)

## 源码来源

基于 `@codemirror/lang-python` 6.2.1；具体来源与本地差异见 [UPSTREAM.json](./UPSTREAM.json)。

## 许可

[MIT](./LICENSE)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

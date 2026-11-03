# @quirekit/cm-view

[English](./README.md) | 简体中文

把 CodeMirror 编辑状态显示为可输入的浏览器编辑区域。

## 安装

```bash
npm install @quirekit/cm-view
```

## 使用方式

在浏览器挂载 EditorView。应用负责给容器布局，离开页面时调用 destroy()。示例另需 cm-state。

```ts
import { EditorState } from '@quirekit/cm-state'
import { EditorView } from '@quirekit/cm-view'

const parent = document.createElement('div')
document.body.append(parent)
const view = new EditorView({ state: EditorState.create({ doc: 'Hello' }), parent })
// Call view.destroy() when the editor is no longer needed.
```

## 使用时注意

- 由 `@codemirror/view` 6.43.13 的源码维护而来；来源和本地差异记录在 UPSTREAM.json。
- 同一实例统一使用 @quirekit/cm-* 包，不与官方 @codemirror/* 的实例混用。

## 相关说明

- [基于这些包的 Markdown 编辑器](../../msfe/core/README.zh-CN.md)

## 许可

[MIT](./LICENSE)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

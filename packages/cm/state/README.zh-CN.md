# @quirekit/cm-state

[English](./README.md) | 简体中文

保存 CodeMirror 的文字、选区和扩展设置，通过事务得到新的编辑状态。

## 安装

```bash
npm install @quirekit/cm-state
```

## 使用方式

使用 EditorState.create({ doc, extensions }) 创建状态，再用 state.update(...) 描述修改。文字保存在 state.doc 中。

```ts
import { EditorState } from '@quirekit/cm-state'

const state = EditorState.create({ doc: 'Hello' })
const next = state.update({ changes: { from: 5, insert: ' QuireKit' } }).state
console.log(next.doc.toString())
```

## 使用时注意

- 由 `@codemirror/state` 6.7.6 的源码维护而来；来源和本地差异记录在 UPSTREAM.json。
- 同一实例统一使用 @quirekit/cm-* 包，不与官方 @codemirror/* 的实例混用。

## 相关说明

- [基于这些包的 Markdown 编辑器](../../msfe/core/README.zh-CN.md)

## 许可

[MIT](./LICENSE)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

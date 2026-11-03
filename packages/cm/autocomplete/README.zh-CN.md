# @quirekit/cm-autocomplete

[English](./README.md) | 简体中文

提供 CodeMirror 的代码补全列表和括号自动补全。

## 安装

```bash
npm install @quirekit/cm-autocomplete
```

## 使用方式

将 autocompletion() 加入编辑器的 extensions。应用可以提供 completion source 返回建议；接受建议由编辑器更新文字。

## 使用时注意

- 由 `@codemirror/autocomplete` 6.20.3 的源码维护而来；来源和本地差异记录在 UPSTREAM.json。
- 同一实例统一使用 @quirekit/cm-* 包，不与官方 @codemirror/* 的实例混用。

## 相关说明

- [基于这些包的 Markdown 编辑器](../../msfe/core/README.zh-CN.md)

## 许可

[MIT](./LICENSE)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

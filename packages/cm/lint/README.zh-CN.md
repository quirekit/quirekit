# @quirekit/cm-lint

[English](./README.md) | 简体中文

在 CodeMirror 中显示语法检查结果和问题位置。

## 安装

```bash
npm install @quirekit/cm-lint
```

## 使用方式

使用 linter(source) 把自己的检查函数接入编辑器；source 返回带 from、to、severity 和 message 的问题列表。本包本身不是某种语言的检查器。

## 使用时注意

- 由 `@codemirror/lint` 6.9.7 的源码维护而来；来源和本地差异记录在 UPSTREAM.json。
- 同一实例统一使用 @quirekit/cm-* 包，不与官方 @codemirror/* 的实例混用。

## 相关说明

- [基于这些包的 Markdown 编辑器](../../msfe/core/README.zh-CN.md)

## 许可

[MIT](./LICENSE)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

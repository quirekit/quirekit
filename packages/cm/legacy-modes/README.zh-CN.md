# @quirekit/cm-legacy-modes

[English](./README.md) | 简体中文

提供旧式 CodeMirror 语言模式，补充没有独立现代语言包的语法。

## 安装

```bash
npm install @quirekit/cm-legacy-modes
```

## 使用方式

从 /mode/<名称> 子入口选择语言，并用 cm-language 的 StreamLanguage.define(...) 转为扩展。本包没有可直接导入的根入口。可用模式见包内 mode 目录。

## 使用时注意

- 由 `@codemirror/legacy-modes` 6.5.4 的源码维护而来；来源和本地差异记录在 UPSTREAM.json。
- 同一实例统一使用 @quirekit/cm-* 包，不与官方 @codemirror/* 的实例混用。

## 相关说明

- [基于这些包的 Markdown 编辑器](../../msfe/core/README.zh-CN.md)

## 许可

[MIT](./LICENSE)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

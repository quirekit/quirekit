# @quirekit/cm-language

[English](./README.md) | 简体中文

提供 CodeMirror 语言解析、高亮、缩进和折叠的公共工具。

## 安装

```bash
npm install @quirekit/cm-language
```

## 使用方式

通常先选择 cm-lang-javascript 等具体语言包。开发新语言支持时，再使用 LanguageSupport、LRLanguage 或 StreamLanguage。

## 使用时注意

- 由 `@codemirror/language` 6.12.4 的源码维护而来；来源和本地差异记录在 UPSTREAM.json。
- 同一实例统一使用 @quirekit/cm-* 包，不与官方 @codemirror/* 的实例混用。

## 相关说明

- [基于这些包的 Markdown 编辑器](../../msfe/core/README.zh-CN.md)

## 许可

[MIT](./LICENSE)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

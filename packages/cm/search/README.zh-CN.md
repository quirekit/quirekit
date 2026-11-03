# @quirekit/cm-search

[English](./README.md) | 简体中文

为 CodeMirror 提供查找、替换、搜索面板和匹配高亮。

## 安装

```bash
npm install @quirekit/cm-search
```

## 使用方式

将 search() 加入编辑器，并用 cm-view 的 keymap.of(searchKeymap) 绑定搜索快捷键。可调用 openSearchPanel(view) 打开面板。

## 使用时注意

- 由 `@codemirror/search` 6.7.2 的源码维护而来；来源和本地差异记录在 UPSTREAM.json。
- 同一实例统一使用 @quirekit/cm-* 包，不与官方 @codemirror/* 的实例混用。

## 相关说明

- [基于这些包的 Markdown 编辑器](../../msfe/core/README.zh-CN.md)

## 许可

[MIT](./LICENSE)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

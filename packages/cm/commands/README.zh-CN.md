# @quirekit/cm-commands

[English](./README.md) | 简体中文

提供 CodeMirror 的光标移动、编辑、历史记录和默认快捷键。

## 安装

```bash
npm install @quirekit/cm-commands
```

## 使用方式

将 history() 和 keymap.of([...defaultKeymap, ...historyKeymap]) 加入编辑器的 extensions。keymap 从 cm-view 导入；只装命令包不会自动绑定快捷键。

## 使用时注意

- 由 `@codemirror/commands` 6.11.1 的源码维护而来；来源和本地差异记录在 UPSTREAM.json。
- 同一实例统一使用 @quirekit/cm-* 包，不与官方 @codemirror/* 的实例混用。

## 相关说明

- [基于这些包的 Markdown 编辑器](../../msfe/core/README.zh-CN.md)

## 许可

[MIT](./LICENSE)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

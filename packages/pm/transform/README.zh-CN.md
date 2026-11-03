# @quirekit/pm-transform

[English](./README.md) | 简体中文

提供插入、删除、替换和位置映射等文档变换。

本包在 `@quirekit` 名下维护 ProseMirror 的对应能力，供 QuireKit 及其扩展使用。

## 安装

```bash
npm install @quirekit/pm-transform
```

## 使用方式

适合编写底层文档操作；一般应用优先调用 Core 的编辑命令。

常用入口：Transform、Step、Mapping。

## 使用时注意

- 同一个编辑器使用同一组 @quirekit/pm-* 包，不要混用官方 prosemirror-* 实例，否则节点、选区或插件可能来自不同的包实例。
- 需要完整编辑器时，从 Core 和 StarterKit 开始即可，不必逐个组合底层包。

## 相关说明

- [Core 编辑器](../../core/editor/README.zh-CN.md)
- [原生 DOM 视图](../../dom-view/README.zh-CN.md)

## 许可

[MIT](./LICENSE)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

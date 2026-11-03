# @quirekit/block-numbering

[English](./README.md) | 简体中文

给 Block Editor 增加与 Word 共用的项目符号和自动编号。

## 安装

```bash
npm install @quirekit/block-numbering
```

## 使用方式

调用 `createBlockNumberingExtensions()`，把返回的扩展数组加入 Block Editor 的 `extensions`。它用于明确选择这些增强功能的应用；基础 Block Editor 可以独立使用。

## 使用时注意

- 这里复用 Word 编号规则，包含连续页面的显示和操作适配；不需要加载 Classic 窗口。

## 相关说明

- [Block Editor 接入](../block-editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

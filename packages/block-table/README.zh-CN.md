# @quirekit/block-table

[English](./README.md) | 简体中文

给 Block Editor 增加 Word 表格节点和编辑命令。

## 安装

```bash
npm install @quirekit/block-table
```

## 使用方式

调用 `createBlockTableExtensions()`，把返回的扩展数组加入 Block Editor 的 `extensions`。它用于明确选择这些增强功能的应用；基础 Block Editor 可以独立使用。

## 使用时注意

- 表格功能不会把连续文档变成分页编辑器；Vue 表格菜单通过 Block 的 tools 插槽接入。
- 菜单提供网格、横线、隔行底色三种整表风格，以及表头行和标题列开关；正文、尺寸和文字格式保留，操作可撤销。
- 结构选区或单元格光标可粘贴 TSV / HTML 表格内容。超出目标时向右下扩展；合并结构不兼容时拒绝整次粘贴并保留原内容。
- 风格随 JSON 文档保留。通过 Block 文件菜单导出静态 HTML 时，内置风格会转成可独立显示的 CSS。

## 相关说明

- [Block Editor 接入](../block-editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

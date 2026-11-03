# @quirekit/classic-table-model

[English](./README.md) | 简体中文

Word 兼容的表格：表格、行、单元格的数据模型与结构，插入删除行列、合并拆分单元格、列宽、表格样式、排序和复制粘贴等编辑命令，以及分页排版所需的表格版面。不含 DOCX 导入导出与修订留痕，可在任何 QuireKit 编辑器中使用。

## 安装

```bash
npm install @quirekit/classic-table-model
```

## 使用方式

把 `WordTableExtensions` 展开到编辑器扩展中，并安装 `@quirekit/classic-styles-model`。需要与 Word 文档互转或修订留痕时，改用商业包 `@quirekit/classic-table`，它包含本包全部内容并加入 DOCX 编解码与修订集成。

## 使用时注意

- 本包与 `@quirekit/classic-table` 二选一安装，不要同时注册两份表格节点。
- 闭源产品使用本包需购买 QuireKit 商业授权。

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

# @quirekit/classic-paragraph-model

[English](./README.md) | 简体中文

Word 兼容的段落格式：对齐、缩进、间距、制表位、分页符与分栏符的数据模型、结构和编辑命令。不含 DOCX 导入导出，可在任何 QuireKit 编辑器中使用。

## 安装

```bash
npm install @quirekit/classic-paragraph-model
```

## 使用方式

把 `WordParagraphNode` 和 `WordParagraph` 加入编辑器扩展，即可设置段落格式；`resolveWordParagraphFormatting` 等函数用于读取与解析格式。需要与 Word 文档互转时，改用商业包 `@quirekit/classic-paragraph`，它包含本包全部内容并加入 DOCX 编解码。

## 使用时注意

- 本包与 `@quirekit/classic-paragraph` 二选一安装，不要同时注册两份段落扩展。

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

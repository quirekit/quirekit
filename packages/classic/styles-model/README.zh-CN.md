# @quirekit/classic-styles-model

[English](./README.md) | 简体中文

Word 兼容的命名样式：段落样式、字符样式、文档主题与默认字体的数据模型、解析与编辑命令。不含 DOCX 导入导出，可在任何 QuireKit 编辑器中使用。

## 安装

```bash
npm install @quirekit/classic-styles-model
```

## 使用方式

把 `WordStyles` 加入编辑器扩展，即可应用“标题 1”“正文”等样式并解析样式继承；需要段落格式时同时安装 `@quirekit/classic-paragraph-model`。需要与 Word 文档互转时，改用商业包 `@quirekit/classic-styles`，它包含本包全部内容并加入 DOCX 编解码。

## 使用时注意

- 本包与 `@quirekit/classic-styles` 二选一安装，不要同时注册两份样式扩展。
- 闭源产品使用本包需购买 QuireKit 商业授权。

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

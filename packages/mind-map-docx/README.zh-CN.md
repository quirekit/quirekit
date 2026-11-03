# @quirekit/mind-map-docx

[English](./README.md) | 简体中文

让 思维导图可以随 Word 文档导出，并保留回到 QuireKit 后继续编辑所需的数据。

## 安装

```bash
npm install @quirekit/mind-map-docx
```

## 使用方式

把 `createMindMapDocxCodec()` 创建的转换规则注册到 DOCX 转换流程。导出时需要对象数据和可显示的预览；导入时尝试恢复随文件保存的数据。

## 使用时注意

- Word 里显示的预览不等于 Word 原生可编辑的同类对象。第三方软件重新保存文件后，也可能丢失附带的数据。
- 本包处理一种文档对象；读取或生成整个 DOCX 文件使用 Lit DOCX 或 Classic DOCX。

## 相关说明

- [原始数据](../mind-map/README.zh-CN.md)
- [DOCX 文件读写](../lit-docx/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

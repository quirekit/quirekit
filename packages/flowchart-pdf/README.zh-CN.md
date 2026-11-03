# @quirekit/flowchart-pdf

[English](./README.md) | 简体中文

把流程图导出成 PDF，供下载、分享或打印。

## 安装

```bash
npm install @quirekit/flowchart-pdf
```

## 使用方式

使用 `encodeFlowchartPdf()` 编码流程图，先通过 `provideFlowchartPdfFonts()` 提供实际使用的字体。完整界面可以从 Flow Editor 的导出操作接入。

## 使用时注意

- 字体必须覆盖图中文字；缺少中文等字符的字体不能正确生成这些文字。
- 这是流程图导出器，整篇分页文档的 PDF 导出由 PDF 包处理。

## 相关说明

- [流程图编辑器](../flow-editor/README.zh-CN.md)
- [文档 PDF 导出](../pdf/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

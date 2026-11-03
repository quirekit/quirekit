# @quirekit/md-editor-basic-export

[English](./README.md) | 简体中文

为 Md Editor 提供开源的基础 Word 导入导出与 PDF 导出。转换由成熟的开源库完成，本包只负责接到编辑器的文件接口上。

## 安装

```bash
npm install @quirekit/md-editor-basic-export
```

## 使用方式

把 `mdBasicDocx()` 作为 MdEditor `docx` 选项的 `converter`，把 `mdBasicPdfExport()` 放进 `exporters`：

```ts
import { mdBasicDocx, mdBasicPdfExport } from '@quirekit/md-editor-basic-export';

const docx = { converter: mdBasicDocx() };
const exporters = [mdBasicPdfExport()];
```

第三方库在第一次导入或导出时才加载。PDF 默认内嵌 `@quirekit/font-pack` 的思源黑体（Noto Sans Hans），
如果应用自己提供字体，可通过 `mdBasicPdfExport({ fonts })` 传入地址或字节。

## 能力边界

| 方向 | 实现 | 说明 |
| --- | --- | --- |
| Markdown → Word | `@mohtasham/md-to-docx` | 原生标题、列表、表格、公式与脚注 |
| Word → Markdown | Mammoth 与 Turndown | 正文、标题、列表、表格、链接与图片；Word 原生公式、版式、批注和修订不导入 |
| Markdown → PDF | pdfmake | 在浏览器中生成 PDF 字节；公式保留为 LaTeX 源码，脚注排在文末，斜体以正体显示 |

MSFE 的专有内容按下列方式降级，每一项都写进导出报告，不会静默丢失：

- 容器转为引用块，提示类容器在 Word 中显示为提示块；
- 带预览图的流程图、思维导图和白板导出为预览图片，其他扩展块替换为占位文字；
- Mermaid、PlantUML 等文本图表保留为代码；
- 所选导出样式不应用，使用库的默认版式。

本包不提供 OFD 导出，也不保证导出效果。需要导入保真、扩展块往返、版式 PDF/OFD 与统一导出模板时，
请使用 QuireKit 的专业导出组件。

## 已知问题

`@mohtasham/md-to-docx` 4.0.1 在标题段落中写入两个段落样式。Word 能正常识别为标题，但用本包的
基础导入直接读回自己导出的文件时，标题会变为普通段落；经 Word 打开另存后的文件不受影响。

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。所依赖的
`@mohtasham/md-to-docx`、Turndown、pdfmake 为 MIT，Mammoth 为 BSD-2-Clause，字体为 SIL OFL。

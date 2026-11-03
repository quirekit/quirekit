# @quirekit/export-template

[English](./README.md) | 简体中文

描述导出文档使用的页面、字体、段落和其他排版样式。多个导出格式可以共用一份模板。

## 安装

```bash
npm install @quirekit/export-template
```

## 使用方式

用 `resolveExportTemplate()` 补全并校验模板设置。下面读取内置默认模板；选择模板的界面和存储由模板库包提供。

```ts
import { resolveExportTemplate } from '@quirekit/export-template'

const style = resolveExportTemplate()
console.log(style)
```

## 相关说明

- [模板库](../export-template-library/README.zh-CN.md)
- [Markdown 文件导出](../md-editor/export/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

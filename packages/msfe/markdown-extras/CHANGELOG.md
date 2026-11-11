# @quirekit/msfe-markdown-extras

## 0.0.3

### Patch Changes

- Update DOMPurify to 3.4.17, which fixes published sanitizer bypasses.

  将 DOMPurify 升级到 3.4.17，修复已公开的净化绕过问题。

- Ship the command and AI capability typings that were missing from the published declarations, so `editor.commands` type-checks the HTML sandbox commands and the Block Editor footnote, math, code, attachment, web card and definition commands without extra setup.

  补上已发布类型声明中缺失的命令与 AI 能力类型，`editor.commands` 调用 HTML 沙箱命令，以及 Block Editor 的脚注、公式、代码、附件、网页卡片和定义命令时，不再需要额外声明。

## 0.0.2

### Patch Changes

- Mermaid previews reuse their rendered output for the same source and font, so switching views or remounting a document no longer lays the diagrams out again.

  Mermaid 预览按相同源码与字体复用已渲染的结果，切换视图或重新挂载文档时不再重新排版图表。

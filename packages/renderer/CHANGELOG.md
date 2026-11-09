# @quirekit/renderer

## 0.0.2

### Patch Changes

- Preserve legacy Word document default tab intervals through DOCX and LitAST, and consume them in Classic ordinary text after explicit stops and across hanging indents. Keep plain paragraphs on their existing layout path and share the validated default with numbering.

  保留旧版 Word 文档默认制表间隔并贯通 DOCX、LitAST 与 Classic 普通文字布局，超过显式位置后继续默认网格，悬挂首行优先到缩进边缘；无 Tab 段落保留原布局路径，编号共享同一有效缺省值。

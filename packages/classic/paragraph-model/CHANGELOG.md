# @quirekit/classic-paragraph-model

## 0.0.3

## 0.0.2

### Patch Changes

- Preserve legacy Word document default tab intervals through DOCX and LitAST, and consume them in Classic ordinary text after explicit stops and across hanging indents. Keep plain paragraphs on their existing layout path and share the validated default with numbering.

  保留旧版 Word 文档默认制表间隔并贯通 DOCX、LitAST 与 Classic 普通文字布局，超过显式位置后继续默认网格，悬挂首行优先到缩进边缘；无 Tab 段落保留原布局路径，编号共享同一有效缺省值。

- Merge paragraph tab stops across style and direct formatting by position, consume explicit clear instructions without disabling the document grid, and retain each original layer for editing and DOCX round trips. Keep unsupported list tabs in canonical data without guessing their layout. Remove the obsolete legacy DOC inheritance warning while preserving unsupported-format diagnostics.

  按位置合并样式与直接格式的段落制表位，消费明确清除指令而不关闭文档默认网格，并保留各原始层用于编辑与 DOCX 往返。未支持的列表制表位保存在规范数据中，不猜测其布局。移除已解决的旧版 DOC 继承限制诊断，继续报告未支持格式。

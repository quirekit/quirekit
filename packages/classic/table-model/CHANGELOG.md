# @quirekit/classic-table-model

## 0.0.2

### Patch Changes

- The Block editor now declares how its content merges in collaboration, and block identities are no longer rewritten when a peer receives a collaborative change. Numbering and table merge rules live in the shared models, so Classic and Block use the same ones.

  Block 编辑器现在声明了协同时内容如何合并，成员收到协同改动时不再改写块身份。编号与表格的合并规则放在共享模型包中，Classic 与 Block 共用。

- Project legacy DOC table grids, preferred dimensions, row settings and horizontal/vertical merges while retaining physical continuation cells and explicit loss boundaries. Preserve false table-header values in LitAST. Derive Classic horizontal merge rectangles for selection, splitting, history and clipboard output without rewriting source cells.

  旧版 DOC 转换保留表格网格、首选尺寸、行属性及横纵合并，保全物理续格并明确未支持边界；LitAST 保留显式 false 标题行。Classic 派生横向合并矩形，贯通选择、拆分、历史和剪贴板，不改写原始源格。

- Convert legacy DOC floating-table positions, text clearances and overlap rules, including tables in headers and footers. Accept stale header directories when the header story is empty. Honor explicit clearing of imported table-position aliases across Classic layout and DOCX export.

  转换旧版 DOC 浮动表格的位置、文字距离与重叠规则，覆盖页眉页脚中的表格。兼容空页眉故事的残留目录。Classic 布局与 DOCX 导出统一遵循表格定位属性的显式清除，避免导入别名重新生效。

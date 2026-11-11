# @quirekit/lit-docx-contract

## 0.0.3

## 0.0.2

### Patch Changes

- Convert validated same-paragraph legacy textbox chains into independently anchored OOXML frames with one author story. Add JSON-safe LitAST links and native regeneration that preserves chain order through text and geometry edits; Classic retains those links with an explicit warning that cross-frame text layout is unavailable.

  将验证完整的同段落旧版文本框链转换为各自独立锚定、共用一份作者正文的 OOXML 框。补齐 JSON 安全的 LitAST 链接和原生新包生成，使正文及几何编辑后仍保留框顺序；Classic 保全关系，并明确提示尚无跨框文字排版。

- Convert ordinary legacy DOC page borders with generation-aware color precedence, original spacing and section positioning. Preserve self-contained page-border XML through JSON, Classic editing and fresh DOCX export, with explicit limits for native rendering and resource-bound borders.

  转换旧版 DOC 普通页面边框，按新旧记录优先级保留颜色、原始间距与分节定位。自包含页面边框 XML 可经 JSON、Classic 编辑和新 DOCX 导出继续保全，并明确原生绘制及资源关联边框的支持边界。

- Preserve legacy DOC note numbering and placement in document settings and section overrides, keeping explicit zero and source restart semantics. Retain section-end endnote suppression through LitAST and regenerated DOCX, including explicit false. Report native editor limitations and keep settings connected to the actual note parts.

  将旧版 DOC 脚注尾注编号与位置保留到文档设置和分节覆盖，保留显式零与源重启语义。LitAST 和重新生成的 DOCX 保留节末尾注抑制及显式 false。明确报告编辑器原生消费边界，并使设置始终关联实际 note 部件。

- Preserve independent empty section-boundary paragraphs through DOCX and LitAST round trips. Classic keeps their source data outside editable body content and restores endpoint ownership through section splits, merges, undo and revision decisions.

  保全 DOCX 与 LitAST 往返中的独立分节空段。Classic 将源承载数据保存在可编辑正文之外，并在拆节、合节、撤销及修订决策中保留或恢复终点所有权。

- Preserve zero numbering starts through LitAST, DOCX parsing and regeneration, Classic commands, previews and AI format values. Keep instance and replacement-level starts distinct, restore pending main-body sequence identities through validated revision preservation, and keep accepted range-format no-ops from being retried per paragraph. Pending style-bound or auxiliary-story numbering remains outside this preservation path.

  打通 LitAST、DOCX 解析与再生成、Classic 命令、预览及 AI 格式值的零起点，分别保留实例和完整层级的起点；通过校验后的修订保留数据恢复待审正文序列身份，并防止成功无变化的范围格式被拆成逐段重试。该保留路径尚不支持编号样式消费者或辅助 Story 的待审编号。

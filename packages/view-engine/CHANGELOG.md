# @quirekit/view-engine

## 0.0.3

## 0.0.2

### Patch Changes

- While an IME composition or presentation overlay is shown, `coordsAtPos` and `posAtCoords` now take and return positions of the committed document, so collaborator carets and other anchors after the composition no longer drift by the length of the preedit text. Frames expose the mapping as `canonicalPositionMapping`.

  输入法组字或展示覆盖层显示期间，`coordsAtPos` 与 `posAtCoords` 按已提交文档的位置收发，协作者光标等位于组字之后的锚点不再偏移预编辑文字的长度。帧通过 `canonicalPositionMapping` 提供这份位置映射。

- Convert automatic legacy DOC footnotes and endnotes with rich author content, connected part graphs and document-wide allocation budgets. Keep optional story refusals explicit and prevent orphaned notes. Preserve table cell paint when auxiliary stories receive page-local geometry identities.

  转换旧版 DOC 的自动脚注尾注，保留富正文、完整部件引用图和整文档分配预算。明确报告可选故事拒绝并避免孤立注释。修复辅助故事生成页面几何身份时表格单元格文字未绘制的问题。

# @quirekit/classic-numbering-model

## 0.0.3

## 0.0.2

### Patch Changes

- The Block editor now declares how its content merges in collaboration, and block identities are no longer rewritten when a peer receives a collaborative change. Numbering and table merge rules live in the shared models, so Classic and Block use the same ones.

  Block 编辑器现在声明了协同时内容如何合并，成员收到协同改动时不再改写块身份。编号与表格的合并规则放在共享模型包中，Classic 与 Block 共用。

- Preserve legacy Word document default tab intervals through DOCX and LitAST, and consume them in Classic ordinary text after explicit stops and across hanging indents. Keep plain paragraphs on their existing layout path and share the validated default with numbering.

  保留旧版 Word 文档默认制表间隔并贯通 DOCX、LitAST 与 Classic 普通文字布局，超过显式位置后继续默认网格，悬挂首行优先到缩进边缘；无 Tab 段落保留原布局路径，编号共享同一有效缺省值。

- Continue default ancestor counters when an imported or edited multilevel list starts with a child or skips a parent level. Preserve zero starts, declared restart triggers and independent instances. Implicit prefixes of non-root levels marked never-restart remain outside this correction.

  多级列表从子级开始或跳过父级时，后续实际父级编号接续已建立的默认祖先计数，保留零起点、声明的重启触发层及独立实例。非顶层永不重启层的隐式前缀仍不在本次修复范围。

- Accept the standard numeric list tab alignment in numbering levels, matching the paragraph model and preserving imported list starts, marker formatting, and level definitions.

  编号级别接纳标准的 num 列表制表位，与段落模型保持一致，保留导入列表的起点、标记格式与级别定义。

- New lists and custom list definitions get random ids (`quirekit-num-<uuid>`, `quirekit-preset-abstract-<uuid>`) instead of the next number from the document's counter, so two people creating lists in one shared document no longer end up in the same list with one list's style. DOCX export still writes sequential numeric ids.

  新建列表与自定义列表定义使用随机 id（`quirekit-num-<uuid>`、`quirekit-preset-abstract-<uuid>`），不再取文档计数器的下一个编号，两人在同一份共享文档中新建列表时不会再并成同一个列表、套用同一种样式。导出 DOCX 时仍写出连续的数字编号。

- Preserve zero numbering starts through LitAST, DOCX parsing and regeneration, Classic commands, previews and AI format values. Keep instance and replacement-level starts distinct, restore pending main-body sequence identities through validated revision preservation, and keep accepted range-format no-ops from being retried per paragraph. Pending style-bound or auxiliary-story numbering remains outside this preservation path.

  打通 LitAST、DOCX 解析与再生成、Classic 命令、预览及 AI 格式值的零起点，分别保留实例和完整层级的起点；通过校验后的修订保留数据恢复待审正文序列身份，并防止成功无变化的范围格式被拆成逐段重试。该保留路径尚不支持编号样式消费者或辅助 Story 的待审编号。

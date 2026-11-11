# @quirekit/ai-runtime

## 0.0.3

## 0.0.2

### Patch Changes

- Preserve zero numbering starts through LitAST, DOCX parsing and regeneration, Classic commands, previews and AI format values. Keep instance and replacement-level starts distinct, restore pending main-body sequence identities through validated revision preservation, and keep accepted range-format no-ops from being retried per paragraph. Pending style-bound or auxiliary-story numbering remains outside this preservation path.

  打通 LitAST、DOCX 解析与再生成、Classic 命令、预览及 AI 格式值的零起点，分别保留实例和完整层级的起点；通过校验后的修订保留数据恢复待审正文序列身份，并防止成功无变化的范围格式被拆成逐段重试。该保留路径尚不支持编号样式消费者或辅助 Story 的待审编号。

# @quirekit/view-html

## 0.0.3

## 0.0.2

### Patch Changes

- Reuse verified native text-block geometry and spatial indexes during local edits, defer structural selection compilation until needed, and avoid remeasuring committed content-height changes. Preserve complete geometry, DOM recovery, selection, and full measurement for unsupported layouts or invalidated styles.

  局部文字编辑复用经验证的原生块几何和空间索引，按需编译结构选区，并避免对已处理的正文高度变化重复测量。保留完整几何、DOM 恢复和选区行为；未知布局或样式失效仍执行完整测量。

- Coalesce passive element resize notifications through the existing render frame queue to avoid ResizeObserver feedback errors in WebKit. Keep window resize and explicit refresh synchronous. Restore read-only selection focus for semantic copy, retain editing guards, and prevent Backspace from navigating browser history.

  被动元素尺寸通知通过现有渲染帧队列合并，避免 WebKit 的 ResizeObserver 反馈循环错误；窗口尺寸变化与显式刷新仍同步处理。恢复只读选区的焦点以支持语义复制，保留编辑门禁，并阻止退格键触发浏览器历史导航。

- Reduce continuous-flow editing work by refreshing DOM recovery snapshots from observed changes, reusing stable ownership indexes, and resolving text positions with ordered queries. Preserve block identities and correct position mappings through moves, inline formatting, split/join operations, and undo.

  通过观察到的局部变更刷新 DOM 恢复快照，复用稳定的归属索引，并使用有序查询定位文字，减少连续流编辑的重复工作。同时修正块移动、行内格式、拆分合并及撤销时的块身份和位置映射。

- The HTML view now measures positions after an IME composition in the same paragraph, so a collaborator's caret stays on its character while you compose, and it draws collaborators' text selections.

  HTML 视图现在能测量同段组字内容之后的位置，组字时协作者的光标会停在对应文字上；同时会绘制协作者选中的文字范围。

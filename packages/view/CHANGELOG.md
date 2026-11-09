# @quirekit/view

## 0.0.2

### Patch Changes

- While an IME composition or presentation overlay is shown, `coordsAtPos` and `posAtCoords` now take and return positions of the committed document, so collaborator carets and other anchors after the composition no longer drift by the length of the preedit text. Frames expose the mapping as `canonicalPositionMapping`.

  输入法组字或展示覆盖层显示期间，`coordsAtPos` 与 `posAtCoords` 按已提交文档的位置收发，协作者光标等位于组字之后的锚点不再偏移预编辑文字的长度。帧通过 `canonicalPositionMapping` 提供这份位置映射。

- Coalesce passive element resize notifications through the existing render frame queue to avoid ResizeObserver feedback errors in WebKit. Keep window resize and explicit refresh synchronous. Restore read-only selection focus for semantic copy, retain editing guards, and prevent Backspace from navigating browser history.

  被动元素尺寸通知通过现有渲染帧队列合并，避免 WebKit 的 ResizeObserver 反馈循环错误；窗口尺寸变化与显式刷新仍同步处理。恢复只读选区的焦点以支持语义复制，保留编辑门禁，并阻止退格键触发浏览器历史导航。

- While an IME composition is open, the preedit text now moves with the caret when another transaction changes the document, such as a collaborator typing earlier in the same paragraph, instead of staying at its old position until the next keystroke.

  输入法组字期间，如果其他事务改动了文档（例如协作者在同一段前面输入），预编辑文字会跟随光标移动，不再停留在旧位置直到下一次按键。

- Arrow keys now step over an atomic inline node that holds text, such as a phonetic guide, in one press instead of placing the caret inside it, so typed and IME text lands beside the guide rather than becoming part of its base text. After a pointer-selected object is left with the arrow keys, typing at the new caret is no longer blocked.

  方向键现在一次越过带文字内容的原子内联节点（如拼音指南），不再把光标放进节点内部，因此键入和输入法文字会落在拼音旁边，而不是并入它的底字。用方向键离开点选的对象后，在新光标处输入也不再被拦截。

- Mounted views add an optional `getStructuredRangeRects(range, sourceDocument)` query that returns the client boxes of the table cells inside a range, so a remote cell selection can be drawn as whole cells like the local one.

  挂载视图新增可选查询 `getStructuredRangeRects(range, sourceDocument)`，返回范围内各表格单元格在页面中的框，协作者的单元格选区因此能像本地一样画成整格底色。

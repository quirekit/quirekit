# @quirekit/msfe-prose

## 0.0.2

### Patch Changes

- List editing in MD Editor now follows rich-text editors: Backspace at an item's start, empty or not, moves a nested item out one level and turns a root item, task included, into a paragraph, and Backspace on the empty row after a list returns to the last item; Delete at the end of text pulls the next item up without its marker; Enter on an empty item in the middle of a list splits it; text typed after Shift+Enter stays in the same paragraph. `changeListIndent` is exported from `@quirekit/msfe-prose`.

  MD 编辑器的列表操作改为富文本编辑器的习惯：条目开头退格（含空条目）时嵌套项退一级、根条目（含任务项）变成段落，列表后的空行退格回到最后一项末尾；正文末尾按 Delete 把下一项文字接上来且不带标记；列表中间的空项回车会拆开列表；Shift+Enter 后打的字留在同一段。`@quirekit/msfe-prose` 导出 `changeListIndent`。

- Enter between blocks opens one visible row instead of two that shrink once typing starts, and Enter on an empty list item outdents it together with its children instead of leaving them behind as an indented code block.

  在块之间回车只出现一行可输入的空行，不再先出现两行、打字后又收缩；在空列表项上回车时，子项随它一起减少缩进，不再被留下变成缩进代码块。

- Typing in the visual view no longer inserts or removes elements: block controls stay mounted, heading fold controls and table rows are not redrawn when text before them moves. This keeps input fast in host pages with expensive `:has()` rules.

  可视模式打字时不再增删元素：块手柄保持挂载，标题折叠按钮和表格行不会因为前文位移而重绘。宿主页面带有开销较大的 `:has()` 规则时，输入依然流畅。

- The caret at the start of a table cell in the document view now stays inside that cell instead of drawing a full-height line on the border with the previous cell, including while composing. Highlight blocks now use the full width: the icon sits at the start of the first row and later rows and paragraphs begin at the block's left edge, and an empty highlight block keeps one row of height.

  文档视图中表格单元格开头的光标不再画成上一格边框上的整行竖线，组字时也一样，光标停在本单元格内。高亮块改为全宽排版：图标只占第一行开头，后续行与段落从块的左边缘开始；空高亮块保留一行高度。

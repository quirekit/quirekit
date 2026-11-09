# @quirekit/incremark-core

## 0.0.2

### Patch Changes

- Enter in a table cell breaks the line inside the cell, written as `<br>` in GFM; the break reads as a line break, moves and deletes as one character, and renders as a line break in reading views without the HTML opt-in. Tab in the last cell still adds a row.

  在表格单元格里按回车会在格内换行，GFM 中写作 `<br>`；它显示为换行，光标移动和删除时视为一个字符，阅读视图无需开启 HTML 也会渲染为换行。在最后一格按 Tab 仍会新增一行。

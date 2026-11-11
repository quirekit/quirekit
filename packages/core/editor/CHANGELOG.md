# @quirekit/core

## 0.0.3

## 0.0.2

### Patch Changes

- Typing in long documents does less work per keystroke. The delete observer no longer replays a transaction that removed nothing, and the block catalog collects block facts on first use instead of on every document change.

  长文档中每次按键的计算量更小：删除观察器不再重放未删除任何内容的事务，块目录改为首次读取时才收集块信息，而不是每次文档变化都重建。

- Mounted views add an optional `getStructuredRangeRects(range, sourceDocument)` query that returns the client boxes of the table cells inside a range, so a remote cell selection can be drawn as whole cells like the local one.

  挂载视图新增可选查询 `getStructuredRangeRects(range, sourceDocument)`，返回范围内各表格单元格在页面中的框，协作者的单元格选区因此能像本地一样画成整格底色。

# @quirekit/md-editor-comments

## 0.0.3

## 0.0.2

### Patch Changes

- Comment card buttons explain themselves with tooltips, and `QuireCommentAction` provides the same button for host actions.

  评论卡片上的按钮现在用 Tooltip 说明用途，`QuireCommentAction` 为应用自己的按钮提供相同的样式和提示。

- Hosts can add their own buttons to comment cards with the `actions` option of `mdComments`, and `QuireCommentThread` gains an `actions` slot in its header.

  应用可以通过 `mdComments` 的 `actions` 选项在评论卡片上添加自己的按钮，`QuireCommentThread` 的卡片头部也新增了 `actions` 插槽。

- The comment list opens in the rail column when the document layout has room for it, so it no longer covers the page; the side drawer used elsewhere no longer dims the page either.

  评论列表在文档布局放得下时直接在右侧评论栏打开，不再遮挡页面；其他情况使用的侧边抽屉也不再让整页变暗。

- The editor instance gains `setCommentRailVisible()` to hide and show the comment rail, so readers can give the document the full width.

  编辑器实例新增 `setCommentRailVisible()`，可以收起和展开右侧评论栏，让正文使用完整宽度。

- `mdComments` accepts `sideMinWidth`, so hosts with a narrower editor area can keep comments in the side rail.

  `mdComments` 新增 `sideMinWidth`，编辑区较窄的宿主也能把评论显示在右侧。

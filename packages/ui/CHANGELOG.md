# @quirekit/ui

## 0.0.2

### Patch Changes

- Comment card buttons explain themselves with tooltips, and `QuireCommentAction` provides the same button for host actions.

  评论卡片上的按钮现在用 Tooltip 说明用途，`QuireCommentAction` 为应用自己的按钮提供相同的样式和提示。

- Coordinate rounded Segmented tracks with the selection radius and track inset, so custom themes with large group radii retain a consistent nested contour. Keep the optional square shape.

  圆角 Segmented 的外轨道半径与选中块、轨道内缩距离配对，使分组圆角较大的自定义主题仍保持协调的嵌套轮廓，保留可选直角外形。

- Hosts can add their own buttons to comment cards with the `actions` option of `mdComments`, and `QuireCommentThread` gains an `actions` slot in its header.

  应用可以通过 `mdComments` 的 `actions` 选项在评论卡片上添加自己的按钮，`QuireCommentThread` 的卡片头部也新增了 `actions` 插槽。

- MD Editor adds keyboard shortcuts for inline formats, headings, lists and the code block, shows each shortcut in the toolbar tooltips, and opens a shortcut reference with Mod-/ or the toolbar's keyboard button. Toolbar entries and Tooltip content accept a `shortcut` to display.

  MD 编辑器为行内格式、标题、列表和代码块加上快捷键，工具栏提示显示对应按键，按 Mod-/ 或点工具栏的键盘按钮可打开快捷键一览。工具栏条目与 Tooltip 内容新增 `shortcut` 用于显示按键。

- The README now shows the full standalone setup: the shared stylesheet, the icon and theme providers, and what single-script bundles must include.

  README 补充了不依赖现有应用的完整接入方式：公共样式、图标和主题 Provider，以及打包成单个脚本时需要包含的内容。

- Add a pill shape to Segmented that gives the track, selection indicator and hover surfaces complete semicircular ends. Keep the existing rounded-rectangle default and optional square appearance.

  新增 Segmented 胶囊外形，使轨道、选中块与悬浮区域的两端均呈完整半圆，保留现有圆角矩形默认值与可选直角外观。

- Add a plain Accordion variant that groups items with spacing instead of an outer frame and separators, while preserving keyboard navigation and the existing outlined default.

  新增 Accordion 无框外观，以间距代替外框和条目分隔线，保留键盘导航与现有默认描边外观。保留共享的键盘焦点反馈。

- Select items accept a `shortcut` shown beside the label, and MD Editor's text style menu lists the heading shortcuts.

  Select 选项新增 `shortcut`，显示在名称旁；MD 编辑器的文字样式菜单列出各级标题的快捷键。

- Add an opt-in square shape to Segmented so its track, selection indicator and hover surfaces share straight corners, while preserving the themed rounded default and existing interaction behavior.

  新增 Segmented 可选直角外形，使轨道、选中块与悬浮区域统一使用直角，保留现有主题圆角默认值和交互行为。

- Export `@quirekit/ui/styles.css` so the block handle and other components with their own styles render correctly from the published package.

  导出 `@quirekit/ui/styles.css`，使块手柄等自带样式的组件在发布包中也能正确显示。

- Classic and Block editors now share the Markdown editor's block handle: one chip with a colored block-type mark and a muted grip. Classic shows its insert button only on empty paragraphs; other blocks insert through the handle menu. Dragging a block now shows the grabbing cursor everywhere. New `QuireBlockHandle` component.

  Classic 与 Block 编辑器的块拖拽手柄统一为 Markdown 编辑器的样式：一个按钮内显示带颜色的块类型标记和弱化的拖拽点。Classic 的插入按钮只在空段落显示，其他块通过手柄菜单插入。拖动块时光标始终显示为抓取状态。新增 `QuireBlockHandle` 组件。

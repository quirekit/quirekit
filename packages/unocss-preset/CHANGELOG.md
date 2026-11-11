# @quirekit/unocss-preset

## 0.0.3

### Patch Changes

- Make Prose and Typography element defaults cheap to match in Safari and other system WebKit hosts. Their scoped selectors now start with a plain tag or `data-qk-prose` role, and the rules live in a `qk-elements` layer nested inside `qk-recipes`, so every recipe and utility still overrides them. A full-page style recalculation on a 2,000-element page drops from about 600 ms to 60 ms; scope roots, limits and computed styles are unchanged.

  降低 Prose 与 Typography 元素默认样式在 Safari 等系统 WebKit 环境中的匹配开销。作用域内的选择器改为直接以标签或 `data-qk-prose` 角色开头，规则放入 `qk-recipes` 内的 `qk-elements` 子层，组件配方和工具类仍可覆盖。约 2000 个元素的页面整页样式重算由约 600ms 降到 60ms；作用域的起止范围与计算样式不变。

## 0.0.2

### Patch Changes

- Comment card buttons explain themselves with tooltips, and `QuireCommentAction` provides the same button for host actions.

  评论卡片上的按钮现在用 Tooltip 说明用途，`QuireCommentAction` 为应用自己的按钮提供相同的样式和提示。

- Coordinate rounded Segmented tracks with the selection radius and track inset, so custom themes with large group radii retain a consistent nested contour. Keep the optional square shape.

  圆角 Segmented 的外轨道半径与选中块、轨道内缩距离配对，使分组圆角较大的自定义主题仍保持协调的嵌套轮廓，保留可选直角外形。

- MD Editor adds keyboard shortcuts for inline formats, headings, lists and the code block, shows each shortcut in the toolbar tooltips, and opens a shortcut reference with Mod-/ or the toolbar's keyboard button. Toolbar entries and Tooltip content accept a `shortcut` to display.

  MD 编辑器为行内格式、标题、列表和代码块加上快捷键，工具栏提示显示对应按键，按 Mod-/ 或点工具栏的键盘按钮可打开快捷键一览。工具栏条目与 Tooltip 内容新增 `shortcut` 用于显示按键。

- Add a pill shape to Segmented that gives the track, selection indicator and hover surfaces complete semicircular ends. Keep the existing rounded-rectangle default and optional square appearance.

  新增 Segmented 胶囊外形，使轨道、选中块与悬浮区域的两端均呈完整半圆，保留现有圆角矩形默认值与可选直角外观。

- Add a plain Accordion variant that groups items with spacing instead of an outer frame and separators, while preserving keyboard navigation and the existing outlined default.

  新增 Accordion 无框外观，以间距代替外框和条目分隔线，保留键盘导航与现有默认描边外观。保留共享的键盘焦点反馈。

- The precompiled `quirekit.css` now includes the layout utilities used by MD Editor, so hosts without UnoCSS get correct dialogs and no longer see the browser's native file control when inserting an image.

  预编译的 `quirekit.css` 现在包含 MD Editor 用到的布局工具类，未接入 UnoCSS 的应用对话框布局正确，插入图片时也不再出现浏览器原生的文件选择控件。

- `==highlight==` defaults to highlighter yellow in every theme, softened in the dark scheme, instead of a tint of the theme's primary color; `--qk-prose-mark-background` still overrides it.

  `==高亮==` 默认改为荧光黄，不再取主题主色的浅色，深色方案自动降低浓度；仍可通过 `--qk-prose-mark-background` 覆盖。

- Key the scoped Prose and typography rules to their tags and roles, so browsers skip them for unrelated elements and scrolling long Markdown documents drops fewer frames. Rendering and specificity stay the same.

  把 Prose 与排版的 `@scope` 规则按标签和角色归类，浏览器不再对无关元素逐条匹配，长 Markdown 文档滚动时掉帧更少；显示效果和选择器优先级不变。

- Select items accept a `shortcut` shown beside the label, and MD Editor's text style menu lists the heading shortcuts.

  Select 选项新增 `shortcut`，显示在名称旁；MD 编辑器的文字样式菜单列出各级标题的快捷键。

- Add an opt-in square shape to Segmented so its track, selection indicator and hover surfaces share straight corners, while preserving the themed rounded default and existing interaction behavior.

  新增 Segmented 可选直角外形，使轨道、选中块与悬浮区域统一使用直角，保留现有主题圆角默认值和交互行为。

- The caret at the start of a table cell in the document view now stays inside that cell instead of drawing a full-height line on the border with the previous cell, including while composing. Highlight blocks now use the full width: the icon sits at the start of the first row and later rows and paragraphs begin at the block's left edge, and an empty highlight block keeps one row of height.

  文档视图中表格单元格开头的光标不再画成上一格边框上的整行竖线，组字时也一样，光标停在本单元格内。高亮块改为全宽排版：图标只占第一行开头，后续行与段落从块的左边缘开始；空高亮块保留一行高度。

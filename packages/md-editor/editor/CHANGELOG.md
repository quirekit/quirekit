# @quirekit/md-editor

## 0.0.2

### Patch Changes

- A `#` typed without its space now stays visible as text and becomes a heading when the space is typed, instead of switching to heading size before the space.

  只输入 `#`、还没输入空格时按文字显示，输入空格后才变成标题；之前会在输入空格前就切换成标题字号。

- A list marker typed without its space, such as `-` or `1.`, now stays visible as text, and becomes a list item when the space is typed, instead of already showing a bullet that a following space seems not to change.

  只输入列表标记、还没输入空格时（如 `-`、`1.`），它会作为文字显示，输入空格后才变成列表项；之前会提前显示圆点，导致接着输入空格看起来没有任何变化。

- MD Editor block editing is consistent across Chrome, Safari and Firefox: Backspace on an empty list item, including one with trailing spaces, peels it like any other item instead of moving the caret through invisible spaces; leaving a list or quote with Enter no longer joins text typed afterwards to the next paragraph; Enter before a heading's text opens a paragraph above it; Backspace and Delete next to code blocks, tables, containers and dividers no longer break them; Left and Right step over dividers and rendered previews; text typed after a bold, link or other style that ends a line stays outside it in Firefox.

  MD 编辑器的块编辑在 Chrome、Safari 与 Firefox 中表现一致：空列表项（含尾随空格）退格与其他条目一样逐层剥离，不再在看不见的空格间来回移动光标；回车退出列表或引用后打的字不再并进下一段；标题开头回车在上方新开段落；代码块、表格、容器和分隔线旁的退格与 Delete 不再破坏结构；左右方向键越过分隔线和渲染预览；Firefox 中在行尾的加粗、链接等格式后打字留在格式外。

- Clicking below the end of a document, including the empty area under the editor, writes at the end as in rich editors: after a code block, table, divider, diagram or formula it opens a new paragraph instead of entering the block or placing the caret before a diagram.

  点击文档末尾下方（包括编辑器下方的空白区域）时与富文本编辑器一致地在末尾继续书写：最后是代码块、表格、分隔线、图表或公式时会新开段落，不再进入块内或把光标放到图表前面。

- Enter after typing a container opener such as `::: note` or `$$` adds the closing marker, as typing a code fence does, so the rest of the document is no longer swallowed into the unclosed block; `$$` then opens the formula editor.

  输入 `::: note` 之类的容器开头或 `$$` 后回车会补上收尾标记（与输入代码围栏一致），文档其余部分不再被并入未闭合的块；`$$` 回车后会直接打开公式编辑器。

- Input-method text composed beside a divider or rendered preview also goes into a new paragraph when the composition starts without a preceding key press.

  在分隔线或渲染预览旁用输入法输入时，即使组合开始前没有按键事件，文字也会进入新段落。

- The empty first row of a container's body keeps its line instead of collapsing into a separator, so the caret shows inside the container and stays put when typing begins.

  容器正文的空首行保留行高，不再被折叠成分隔行，光标显示在容器内，开始输入时也不再跳动。

- Deleting or typing over a selection that runs from one block into a heading, list item or quote joins the remaining text into the first block without leaving `#`, `-` or `>` behind as text, and a code block or table it reaches stays separated from the text before it by a blank line.

  删除或输入替换从一个块延伸到标题、列表项或引用中的选区时，剩余文字并入第一个块，不再把 `#`、`-` 或 `>` 留成普通文字；选区触及的代码块或表格仍与前面的文字保持空行分隔。

- Rich-editor typing rules stay out of source editing: in the source view a typed `|` in a table and `(` after `]` are plain characters again, Backspace before a style that starts a block deletes the visible marker wherever markers are shown, and clicking below the document places the caret at its end instead of leaving the editor unfocused.

  富文本编辑器的输入规则不再影响源码编辑：源码视图中表格里输入的 `|` 和 `]` 后输入的 `(` 恢复为普通字符；在显示标记的视图中，块开头样式前的退格删除可见的标记字符；点击文档下方会把光标放到文末，不再让编辑器失去焦点。

- Blocks inserted from the slash, block and insertion menus are now empty instead of carrying sample text such as "New paragraph" or "New heading". The caret lands where typing fills the block: in the heading, list item, first table cell, code block or container body; a definition list selects its required term. Insertion payloads mark that position with `SOURCE_CARET`.

  斜杠、块菜单和插入菜单插入的块不再带“新的段落”“新的标题”之类的示例文字，而是空块；光标直接落在标题、列表项、表格首格、代码块或容器正文中，可以立即输入；定义列表必须有术语，插入后术语处于选中状态。插入内容用 `SOURCE_CARET` 标记光标位置。

- An empty paragraph row, such as the one Enter opens after a code block or table, keeps paragraph spacing, so the first character typed into it no longer moves it.

  空段落行（例如在代码块或表格后回车新开的行）保留段落间距，在其中输入第一个字符时不再移动位置。

- Code blocks and previews follow rich editors: typing ` ```js ` and Enter makes a JavaScript block instead of putting `js` in the code, a habitual Enter right after typing ` ``` ` no longer adds a blank first line, and text typed or composed at the edge of a divider, diagram or formula preview goes into a new paragraph beside it instead of above the block or into the divider.

  代码块与预览块的输入与富文本编辑器一致：输入 ` ```js ` 后回车生成 JavaScript 代码块，`js` 不再进入代码；输入 ` ``` ` 后顺手回车不再多出空首行；在分隔线、图表或公式预览边缘打字或用输入法输入时，文字进入其旁边的新段落，不再跑到块上方或并入分隔线。

- Format shortcuts on a selection follow rich editors: a selection that partly overlaps or contains bold text becomes one bold span, a selection inside bold text removes bold from only that part, a selection of a whole styled span with its markers toggles it off, and a selection across paragraphs, headings, list items or table cells formats each part.

  有选区时的格式快捷键与富文本编辑器一致：与粗体部分重叠或包含粗体的选区会合并成一段粗体；在粗体内部选中一部分只取消该部分；连同标记选中整段样式时取消该样式；跨段落、标题、列表项或表格单元格的选区会逐块应用格式。

- Format shortcuts with no selection follow rich editors: at the end of bold, italic or other styled text the shortcut keeps the existing style and stops it for what is typed next, anywhere in a line; a style started in the middle of text and left without typing leaves no empty markers behind, pressing the shortcut again cancels it, and Enter drops it.

  无选区时的格式快捷键与富文本编辑器一致：在粗体、斜体等样式文字的末尾按快捷键，会保留已有样式、只对后续输入停止该样式，行中间同样如此；在文字中间开启的样式若未输入就离开，不会留下空标记，再按一次快捷键即取消，回车时也会去掉。

- Input-method composition follows the ProseMirror and CodeMirror precedents more closely: pasting while a composition is open is left to the browser, a composition whose end the browser never reported also ends when the editor loses focus, and editing above a heading no longer rebuilds its fold control, so nearby components stay mounted while composing and undoing.

  输入法组字更贴近 ProseMirror 与 CodeMirror 的做法：组字过程中粘贴交给浏览器处理；浏览器没有报告组字结束时，编辑器失焦也会结束组字；在标题上方编辑不再重建其折叠按钮，组字与撤销时附近组件保持不动。

- Typing after a link or bold text that ends a line no longer extends it or splits the link source: End, ⌘→, clicks and the document end land after the closing markers, nested styles such as a bold link included, and toggling the style there stops it instead of removing it. Links are written without angle brackets unless the address needs them, ampersands stay readable, and the document view keeps room below the caret while writing.

  在行尾的链接或加粗后继续输入，不会再并进格式或切断链接源码：End、⌘→、点击行尾和文档末尾都落在收尾标记之后（加粗的链接等嵌套样式同样如此），在那里按格式快捷键只停止后续文字的格式，不移除已有格式。链接地址只在必要时才加尖括号，`&` 不再被转义；文档视图写作时光标下方保留空白。

- Selecting a heading, list item or quote line to its start, as Shift+Home does, selects its text, so deleting it keeps the empty heading, list item or quote for the next text, as in rich editors; select-all still removes whole blocks.

  像 Shift+Home 那样把标题、列表项或引用行选到行首时只选中其文字，删除后保留空的标题、列表项或引用供继续输入，与富文本编辑器一致；全选仍会删除整个块。

- List shortcuts and toolbar buttons follow rich editors: with the caret in an item of another kind, the whole list level changes kind instead of splitting off that item, and turning the list off for one item leaves a paragraph apart from the list halves instead of joining it to the item above.

  列表快捷键与工具栏按钮与富文本编辑器一致：光标位于另一种列表的项中时整层列表一起转换，不再只拆出当前项；对单项取消列表时留下与前后列表分开的段落，不再并入上一项。

- Arrow keys in live preview no longer jump back at the start of a nested list item: the indentation before a list marker is never a caret stop. Moving into a code block stops on its fence row, which is revealed for editing, so Left returns to where Right started.

  实时预览中方向键在嵌套列表项开头不再往回跳：列表标记前的缩进不再是光标停靠点。向右进入代码块时会停在展开的围栏行（可直接修改语言），再按左键回到原处。

- The current block highlight moves as soon as the pointer is pressed in another block, and returns with the caret right after a view switch.

  当前块高亮在另一个块里按下鼠标时立即跟过去，切换视图后也随光标立即出现。

- The block handle and the empty-line insert button become quiet hairline chips with a muted grip, and block icons in the handle, slash menu and insert list are tinted by block family; diagrams, databases, whiteboards, mind maps, footnotes, tasks and duplication get their own icons.

  块手柄与空行插入按钮改为发丝描边的轻量样式，拖拽点改为浅灰；手柄、斜杠菜单和插入列表中的块图标按块类型着色；文本绘图、多维表格、白板、思维导图、脚注、待办与创建副本改用各自专属的图标。

- The block menu lays its twelve conversions out in two even rows of heading icons, separates them from the actions below, and gives inserting above or below its own icons distinct from moving.

  块菜单的十二个转换项改为两行等宽的图标网格（标题也使用图标），与下方操作之间加回分隔线；上方插入、下方插入改用与上移、下移不同的专属图标。

- Enter in a table cell breaks the line inside the cell, written as `<br>` in GFM; the break reads as a line break, moves and deletes as one character, and renders as a line break in reading views without the HTML opt-in. Tab in the last cell still adds a row.

  在表格单元格里按回车会在格内换行，GFM 中写作 `<br>`；它显示为换行，光标移动和删除时视为一个字符，阅读视图无需开启 HTML 也会渲染为换行。在最后一格按 Tab 仍会新增一行。

- The comment list opens in the rail column when the document layout has room for it, so it no longer covers the page; the side drawer used elsewhere no longer dims the page either.

  评论列表在文档布局放得下时直接在右侧评论栏打开，不再遮挡页面；其他情况使用的侧边抽屉也不再让整页变暗。

- The editor instance gains `setCommentRailVisible()` to hide and show the comment rail, so readers can give the document the full width.

  编辑器实例新增 `setCommentRailVisible()`，可以收起和展开右侧评论栏，让正文使用完整宽度。

- An empty row before a container's closing fence stays visible with paragraph spacing, so typing after pressing Enter twice in a container does not move the text.

  容器结束标记前的空行保持可见并带段落间距，在容器里连按两次回车后打字，文字位置不再跳动。

- Delete removes an empty list item or quote row and joins the next block's first line without breaking what remains of it, front matter keeps its closing fence, and Shift+Enter before an item's text or in an empty item no longer breaks the list.

  Delete 会移除空列表项或引用空行，在行尾并入下一块首行时不破坏下一块其余部分，frontmatter 保留结束线；在条目文字前或空条目里按 Shift+回车不再把列表弄坏。

- The full-page document layout reads at article rhythm: a 15px body with a 24px line, 12px between blocks, and more space above higher headings.

  整页文档布局采用文章阅读节奏：正文 15px、行高 24px，块间距 12px，越高级的标题上方留白越多。

- List editing in MD Editor now follows rich-text editors: Backspace at an item's start, empty or not, moves a nested item out one level and turns a root item, task included, into a paragraph, and Backspace on the empty row after a list returns to the last item; Delete at the end of text pulls the next item up without its marker; Enter on an empty item in the middle of a list splits it; text typed after Shift+Enter stays in the same paragraph. `changeListIndent` is exported from `@quirekit/msfe-prose`.

  MD 编辑器的列表操作改为富文本编辑器的习惯：条目开头退格（含空条目）时嵌套项退一级、根条目（含任务项）变成段落，列表后的空行退格回到最后一项末尾；正文末尾按 Delete 把下一项文字接上来且不带标记；列表中间的空项回车会拆开列表；Shift+Enter 后打的字留在同一段。`@quirekit/msfe-prose` 导出 `changeListIndent`。

- `MdEditor` accepts `selectionActions`, host commands shown on the desktop selection toolbar that receive the selected Markdown and its source lines.

  `MdEditor` 新增 `selectionActions`，可以在桌面选区工具栏加入宿主命令，并拿到选中的 Markdown 原文和所在行。

- MD Editor adds keyboard shortcuts for inline formats, headings, lists and the code block, shows each shortcut in the toolbar tooltips, and opens a shortcut reference with Mod-/ or the toolbar's keyboard button. Toolbar entries and Tooltip content accept a `shortcut` to display.

  MD 编辑器为行内格式、标题、列表和代码块加上快捷键，工具栏提示显示对应按键，按 Mod-/ 或点工具栏的键盘按钮可打开快捷键一览。工具栏条目与 Tooltip 内容新增 `shortcut` 用于显示按键。

- The `MdEditor` instance gains `showComments()`, so a host can open the comment list from its own controls.

  `MdEditor` 实例新增 `showComments()`，宿主可以从自己的控件打开评论列表。

- The README now shows the full standalone setup: the shared stylesheet, the icon and theme providers, and what single-script bundles must include.

  README 补充了不依赖现有应用的完整接入方式：公共样式、图标和主题 Provider，以及打包成单个脚本时需要包含的内容。

- Enter between blocks opens one visible row instead of two that shrink once typing starts, and Enter on an empty list item outdents it together with its children instead of leaving them behind as an indented code block.

  在块之间回车只出现一行可输入的空行，不再先出现两行、打字后又收缩；在空列表项上回车时，子项随它一起减少缩进，不再被留下变成缩进代码块。

- Render further ahead while scrolling through the new `EditorView.scrollViewportMargin` facet, paint text-like placeholders on ranges that are not rendered yet, and limit selection-match highlights to source mode, so fast scrolling flashes white less and selecting stays responsive.

  通过新增的 `EditorView.scrollViewportMargin` 在滚动时往前多绘制，在尚未渲染的区域显示文本状占位，并把相同文本高亮限定在源码模式，减少快速滚动闪白，选区也更跟手。

- Clicking right below a container, code block or table that ends the document, or pressing ArrowDown on its last row, opens a paragraph after it instead of trapping the caret inside.

  文档以容器、代码块或表格结尾时，紧贴其下方点击或在最后一行按 ↓，都会在后面新开段落，光标不再被困在块内。

- Empty headings show their level and the empty paragraph holding the caret hints at the slash menu, as rich editors do; empty list items, code, tables and front matter show no hint.

  空标题会显示它的级别，光标所在的空段落会提示斜杠菜单，与主流富文本编辑器一致；空列表项、代码块、表格和 frontmatter 不显示提示。

- Enter at a list item's text start keeps the empty item above as a list item, Enter on an item's line after Shift+Enter starts the next item (renumbering ordered lists), and the empty row after Shift+Enter no longer shifts when typing starts.

  在列表项文字开头回车时，上方留下的空项仍是列表项；Shift+回车后的行再按回车会开始下一项（有序列表自动续号）；Shift+回车留下的空行开始输入时不再跳动。

- Enter in a quote starts a new paragraph inside it, Shift+Enter keeps a line break, and Enter on the opened empty paragraph leaves the quote without an empty quoted line.

  在引用里按回车会在引用内新开一个段落，Shift+回车仍是段内换行；在新开的空段落上回车会离开引用，不留空的引用行。

- A selection that leaves its table cell paints every cell it touches whole, including the cells where it starts and ends, instead of only the endpoint text; a selection inside one cell still follows its text.

  选区一旦跨出所在单元格，所有与之相交的单元格（包括起点和终点所在的格子）都整格高亮，不再只高亮端点处的文字；只在一个单元格内的选区仍然贴着文字绘制。

- A selection across blocks paints along the selected text of every line instead of filling whole block boxes; table cells and previews it covers are painted whole, and a code block's toolbar row stays unpainted.

  跨块选区改为沿每一行被选中的文字绘制，不再整块铺满；被覆盖的表格单元格与预览块整体高亮，代码块的工具栏行不再被选中。

- Typing no longer re-renders toolbar controls whose state did not change, and reference parsing skips a redundant tree walk, which makes keystrokes cheaper in long documents.

  打字时不再重新渲染状态未变的工具栏控件，引用解析也省去一次多余的遍历，长文档按键开销更低。

- Mod-Alt-V steps through the document, live preview, source and reading views when `view` is bound with `v-model:view`, and every view switch leaves focus in the document.

  用 `v-model:view` 绑定视图时，`Mod-Alt-V` 可依次切换文档、实时预览、源码与阅读视图；每次切换视图后焦点都回到文档。

- Pasting follows rich editors: HTML from web pages and documents arrives as Markdown headings, emphasis, links, lists, quotes, code and tables instead of one line of plain text; a URL pasted over selected text links it; text pasted into a table cell stays in that cell, pasted lines continue the list item or quote they land in, a pasted list becomes sibling items, and the caret ends after pasted styled text.

  粘贴与富文本编辑器一致：来自网页和文档的 HTML 会转成 Markdown 的标题、强调、链接、列表、引用、代码和表格，不再变成一行纯文字；在选中文字上粘贴网址会生成链接；粘贴到表格单元格的文字留在该单元格内，粘贴的多行文字延续所在的列表项或引用，粘贴的列表成为同级列表项，粘贴带样式的文字后光标位于其后。

- The precompiled `quirekit.css` now includes the layout utilities used by MD Editor, so hosts without UnoCSS get correct dialogs and no longer see the browser's native file control when inserting an image.

  预编译的 `quirekit.css` 现在包含 MD Editor 用到的布局工具类，未接入 UnoCSS 的应用对话框布局正确，插入图片时也不再出现浏览器原生的文件选择控件。

- Select items accept a `shortcut` shown beside the label, and MD Editor's text style menu lists the heading shortcuts.

  Select 选项新增 `shortcut`，显示在名称旁；MD 编辑器的文字样式菜单列出各级标题的快捷键。

- The caret no longer jumps when typing the first character on an empty quote row or an empty code block line: the empty row is drawn where its text will be.

  在空引用行或空代码行输入第一个字符时，光标不再跳动：空行就画在文字将出现的位置。

- Backspace before bold, a link or another style that starts a list item, heading or quote acts at the start of that block as rich editors do: the list item peels, the heading or quote becomes a paragraph, and the style stays; Backspace and Delete beside nested styles never remove a hidden link or style marker.

  在列表项、标题或引用开头的粗体、链接等样式前按退格时，与富文本编辑器一致地作用于该块开头：列表项逐层剥离，标题或引用变为段落，样式保留；在嵌套样式旁退格或 Delete 不会删掉隐藏的链接或样式标记。

- Backspace and Delete next to bold, italic, inline code, links and other inline styles delete a visible character as in rich editors instead of removing the style: the character before or after the style, or the style's own first or last character, and a paragraph that starts with a style joins the paragraph or heading above it.

  在粗体、斜体、行内代码、链接等行内样式旁按退格或 Delete 时与富文本编辑器一致地删除一个可见字符，不再取消样式：删掉样式前后的字符，或样式自身的首尾字符；以样式开头的段落会并入上方的段落或标题。

- The caret at the start of a table cell in the document view now stays inside that cell instead of drawing a full-height line on the border with the previous cell, including while composing. Highlight blocks now use the full width: the icon sits at the start of the first row and later rows and paragraphs begin at the block's left edge, and an empty highlight block keeps one row of height.

  文档视图中表格单元格开头的光标不再画成上一格边框上的整行竖线，组字时也一样，光标停在本单元格内。高亮块改为全宽排版：图标只占第一行开头，后续行与段落从块的左边缘开始；空高亮块保留一行高度。

- Table cells keep their structure while typing: a typed `|` is cell text, Backspace at the start and Delete at the end of a cell do nothing instead of removing padding and then the cell border, Shift+Enter no longer breaks the row, and Enter after a header row such as `| a | b |` creates the table with an empty first row.

  在表格单元格中输入时保持表格结构：输入的 `|` 作为单元格文字；在单元格开头按退格、末尾按 Delete 不再先删空格再删边框；Shift+Enter 不再拆断表格行；输入 `| a | b |` 这样的表头行后回车会生成带空白首行的表格。

- Typing Markdown link and style syntax works as in rich editors: `(` after a bracketed label no longer adds `)`, so the destination can be typed before the link forms, and after typing a closing `)`, `**`, `*`, `` ` `` or `~~` the caret stays after the finished link or style instead of jumping back inside it.

  输入 Markdown 链接和样式语法与富文本编辑器一致：在方括号文字后输入 `(` 不再自动补 `)`，可以先输完网址再成链接；输入收尾的 `)`、`**`、`*`、`` ` `` 或 `~~` 后，光标留在完成的链接或样式之后，不再跳回里面。

- Classic and Block editors now share the Markdown editor's block handle: one chip with a colored block-type mark and a muted grip. Classic shows its insert button only on empty paragraphs; other blocks insert through the handle menu. Dragging a block now shows the grabbing cursor everywhere. New `QuireBlockHandle` component.

  Classic 与 Block 编辑器的块拖拽手柄统一为 Markdown 编辑器的样式：一个按钮内显示带颜色的块类型标记和弱化的拖拽点。Classic 的插入按钮只在空段落显示，其他块通过手柄菜单插入。拖动块时光标始终显示为抓取状态。新增 `QuireBlockHandle` 组件。

- In the document view every Left or Right press now moves the visible caret: one press at the start of a nested list item reaches the previous line, a line break written as `<br>` takes one press in each direction, and moving across a formula and a divider stops at the same places in both directions. The current-block background no longer shifts left while typing with an input method in Safari.

  文档视图中每次按左右键，看得见的光标都会移动：嵌套列表项开头按一次左键即到上一行；`<br>` 换行左右各按一次即可越过；在公式与分隔线之间来回移动，两个方向停在相同位置。Safari 中用输入法输入时，当前块背景不再向左偏移。

- Enter always moves the caret visibly: on the empty last row after a code block or table it no longer appears to do nothing the first time, and on a divider it opens a paragraph below instead of above.

  回车总能让光标明显移动：在代码块或表格后的末尾空行上，第一次回车不再看似无效；在分隔线上回车会在其下方新开段落，而不是在上方。

- When WebKit drops the end of an input-method composition, editing recovers on the next key, pointer press or blur instead of staying in composition mode, so drag selection, list editing and the current block highlight keep working; the highlight also stays on the block while its text is being composed, and an empty-row hint never draws over the row above.

  WebKit 丢失输入法组字的结束事件时，编辑器会在下一次按键、鼠标按下或失焦时恢复，不再卡在组字状态，拖选、列表编辑和当前块高亮都能正常工作；组字期间当前块高亮保持显示，空行提示也不会再压在上一行上。

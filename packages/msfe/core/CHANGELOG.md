# @quirekit/msfe-core

## 0.0.3

## 0.0.2

### Patch Changes

- MD Editor block editing is consistent across Chrome, Safari and Firefox: Backspace on an empty list item, including one with trailing spaces, peels it like any other item instead of moving the caret through invisible spaces; leaving a list or quote with Enter no longer joins text typed afterwards to the next paragraph; Enter before a heading's text opens a paragraph above it; Backspace and Delete next to code blocks, tables, containers and dividers no longer break them; Left and Right step over dividers and rendered previews; text typed after a bold, link or other style that ends a line stays outside it in Firefox.

  MD 编辑器的块编辑在 Chrome、Safari 与 Firefox 中表现一致：空列表项（含尾随空格）退格与其他条目一样逐层剥离，不再在看不见的空格间来回移动光标；回车退出列表或引用后打的字不再并进下一段；标题开头回车在上方新开段落；代码块、表格、容器和分隔线旁的退格与 Delete 不再破坏结构；左右方向键越过分隔线和渲染预览；Firefox 中在行尾的加粗、链接等格式后打字留在格式外。

- Deleting or typing over a selection that runs from one block into a heading, list item or quote joins the remaining text into the first block without leaving `#`, `-` or `>` behind as text, and a code block or table it reaches stays separated from the text before it by a blank line.

  删除或输入替换从一个块延伸到标题、列表项或引用中的选区时，剩余文字并入第一个块，不再把 `#`、`-` 或 `>` 留成普通文字；选区触及的代码块或表格仍与前面的文字保持空行分隔。

- Blocks inserted from the slash, block and insertion menus are now empty instead of carrying sample text such as "New paragraph" or "New heading". The caret lands where typing fills the block: in the heading, list item, first table cell, code block or container body; a definition list selects its required term. Insertion payloads mark that position with `SOURCE_CARET`.

  斜杠、块菜单和插入菜单插入的块不再带“新的段落”“新的标题”之类的示例文字，而是空块；光标直接落在标题、列表项、表格首格、代码块或容器正文中，可以立即输入；定义列表必须有术语，插入后术语处于选中状态。插入内容用 `SOURCE_CARET` 标记光标位置。

- Format shortcuts on a selection follow rich editors: a selection that partly overlaps or contains bold text becomes one bold span, a selection inside bold text removes bold from only that part, a selection of a whole styled span with its markers toggles it off, and a selection across paragraphs, headings, list items or table cells formats each part.

  有选区时的格式快捷键与富文本编辑器一致：与粗体部分重叠或包含粗体的选区会合并成一段粗体；在粗体内部选中一部分只取消该部分；连同标记选中整段样式时取消该样式；跨段落、标题、列表项或表格单元格的选区会逐块应用格式。

- Format shortcuts with no selection follow rich editors: at the end of bold, italic or other styled text the shortcut keeps the existing style and stops it for what is typed next, anywhere in a line; a style started in the middle of text and left without typing leaves no empty markers behind, pressing the shortcut again cancels it, and Enter drops it.

  无选区时的格式快捷键与富文本编辑器一致：在粗体、斜体等样式文字的末尾按快捷键，会保留已有样式、只对后续输入停止该样式，行中间同样如此；在文字中间开启的样式若未输入就离开，不会留下空标记，再按一次快捷键即取消，回车时也会去掉。

- Typing Chinese with an input method in a heading no longer jumps to the start of the heading in Safari and WebKit desktop apps.

  在 Safari 与 WebKit 桌面端的标题里用输入法打中文，拼音不再跳到标题开头。

- Input-method composition follows the ProseMirror and CodeMirror precedents more closely: pasting while a composition is open is left to the browser, a composition whose end the browser never reported also ends when the editor loses focus, and editing above a heading no longer rebuilds its fold control, so nearby components stay mounted while composing and undoing.

  输入法组字更贴近 ProseMirror 与 CodeMirror 的做法：组字过程中粘贴交给浏览器处理；浏览器没有报告组字结束时，编辑器失焦也会结束组字；在标题上方编辑不再重建其折叠按钮，组字与撤销时附近组件保持不动。

- Typing after a link or bold text that ends a line no longer extends it or splits the link source: End, ⌘→, clicks and the document end land after the closing markers, nested styles such as a bold link included, and toggling the style there stops it instead of removing it. Links are written without angle brackets unless the address needs them, ampersands stay readable, and the document view keeps room below the caret while writing.

  在行尾的链接或加粗后继续输入，不会再并进格式或切断链接源码：End、⌘→、点击行尾和文档末尾都落在收尾标记之后（加粗的链接等嵌套样式同样如此），在那里按格式快捷键只停止后续文字的格式，不移除已有格式。链接地址只在必要时才加尖括号，`&` 不再被转义；文档视图写作时光标下方保留空白。

- Selecting a heading, list item or quote line to its start, as Shift+Home does, selects its text, so deleting it keeps the empty heading, list item or quote for the next text, as in rich editors; select-all still removes whole blocks.

  像 Shift+Home 那样把标题、列表项或引用行选到行首时只选中其文字，删除后保留空的标题、列表项或引用供继续输入，与富文本编辑器一致；全选仍会删除整个块。

- Arrow keys in live preview no longer jump back at the start of a nested list item: the indentation before a list marker is never a caret stop. Moving into a code block stops on its fence row, which is revealed for editing, so Left returns to where Right started.

  实时预览中方向键在嵌套列表项开头不再往回跳：列表标记前的缩进不再是光标停靠点。向右进入代码块时会停在展开的围栏行（可直接修改语言），再按左键回到原处。

- Render further ahead while scrolling through the new `EditorView.scrollViewportMargin` facet, paint text-like placeholders on ranges that are not rendered yet, and limit selection-match highlights to source mode, so fast scrolling flashes white less and selecting stays responsive.

  通过新增的 `EditorView.scrollViewportMargin` 在滚动时往前多绘制，在尚未渲染的区域显示文本状占位，并把相同文本高亮限定在源码模式，减少快速滚动闪白，选区也更跟手。

- Incremental parsing now reuses unchanged groups of blocks whole and no longer reparses paragraphs with links when link definitions did not change, so parsing a keystroke costs about the same in a 3,000,000-character document as in a 100,000-character one.

  增量解析现在整组复用未变的块；链接定义没变时，带链接的段落也不再重复解析。300 万字文档中单次按键的解析开销与 10 万字基本相同。

- Typing no longer re-renders toolbar controls whose state did not change, and reference parsing skips a redundant tree walk, which makes keystrokes cheaper in long documents.

  打字时不再重新渲染状态未变的工具栏控件，引用解析也省去一次多余的遍历，长文档按键开销更低。

- Typing in the visual view no longer inserts or removes elements: block controls stay mounted, heading fold controls and table rows are not redrawn when text before them moves. This keeps input fast in host pages with expensive `:has()` rules.

  可视模式打字时不再增删元素：块手柄保持挂载，标题折叠按钮和表格行不会因为前文位移而重绘。宿主页面带有开销较大的 `:has()` 规则时，输入依然流畅。

- Pasting follows rich editors: HTML from web pages and documents arrives as Markdown headings, emphasis, links, lists, quotes, code and tables instead of one line of plain text; a URL pasted over selected text links it; text pasted into a table cell stays in that cell, pasted lines continue the list item or quote they land in, a pasted list becomes sibling items, and the caret ends after pasted styled text.

  粘贴与富文本编辑器一致：来自网页和文档的 HTML 会转成 Markdown 的标题、强调、链接、列表、引用、代码和表格，不再变成一行纯文字；在选中文字上粘贴网址会生成链接；粘贴到表格单元格的文字留在该单元格内，粘贴的多行文字延续所在的列表项或引用，粘贴的列表成为同级列表项，粘贴带样式的文字后光标位于其后。

- Backspace before bold, a link or another style that starts a list item, heading or quote acts at the start of that block as rich editors do: the list item peels, the heading or quote becomes a paragraph, and the style stays; Backspace and Delete beside nested styles never remove a hidden link or style marker.

  在列表项、标题或引用开头的粗体、链接等样式前按退格时，与富文本编辑器一致地作用于该块开头：列表项逐层剥离，标题或引用变为段落，样式保留；在嵌套样式旁退格或 Delete 不会删掉隐藏的链接或样式标记。

- Backspace and Delete next to bold, italic, inline code, links and other inline styles delete a visible character as in rich editors instead of removing the style: the character before or after the style, or the style's own first or last character, and a paragraph that starts with a style joins the paragraph or heading above it.

  在粗体、斜体、行内代码、链接等行内样式旁按退格或 Delete 时与富文本编辑器一致地删除一个可见字符，不再取消样式：删掉样式前后的字符，或样式自身的首尾字符；以样式开头的段落会并入上方的段落或标题。

- Typing Markdown link and style syntax works as in rich editors: `(` after a bracketed label no longer adds `)`, so the destination can be typed before the link forms, and after typing a closing `)`, `**`, `*`, `` ` `` or `~~` the caret stays after the finished link or style instead of jumping back inside it.

  输入 Markdown 链接和样式语法与富文本编辑器一致：在方括号文字后输入 `(` 不再自动补 `)`，可以先输完网址再成链接；输入收尾的 `)`、`**`、`*`、`` ` `` 或 `~~` 后，光标留在完成的链接或样式之后，不再跳回里面。

- In the document view every Left or Right press now moves the visible caret: one press at the start of a nested list item reaches the previous line, a line break written as `<br>` takes one press in each direction, and moving across a formula and a divider stops at the same places in both directions. The current-block background no longer shifts left while typing with an input method in Safari.

  文档视图中每次按左右键，看得见的光标都会移动：嵌套列表项开头按一次左键即到上一行；`<br>` 换行左右各按一次即可越过；在公式与分隔线之间来回移动，两个方向停在相同位置。Safari 中用输入法输入时，当前块背景不再向左偏移。

- When WebKit drops the end of an input-method composition, editing recovers on the next key, pointer press or blur instead of staying in composition mode, so drag selection, list editing and the current block highlight keep working; the highlight also stays on the block while its text is being composed, and an empty-row hint never draws over the row above.

  WebKit 丢失输入法组字的结束事件时，编辑器会在下一次按键、鼠标按下或失焦时恢复，不再卡在组字状态，拖选、列表编辑和当前块高亮都能正常工作；组字期间当前块高亮保持显示，空行提示也不会再压在上一行上。

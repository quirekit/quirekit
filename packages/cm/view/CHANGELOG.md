# @quirekit/cm-view

## 0.0.3

## 0.0.2

### Patch Changes

- MD Editor block editing is consistent across Chrome, Safari and Firefox: Backspace on an empty list item, including one with trailing spaces, peels it like any other item instead of moving the caret through invisible spaces; leaving a list or quote with Enter no longer joins text typed afterwards to the next paragraph; Enter before a heading's text opens a paragraph above it; Backspace and Delete next to code blocks, tables, containers and dividers no longer break them; Left and Right step over dividers and rendered previews; text typed after a bold, link or other style that ends a line stays outside it in Firefox.

  MD 编辑器的块编辑在 Chrome、Safari 与 Firefox 中表现一致：空列表项（含尾随空格）退格与其他条目一样逐层剥离，不再在看不见的空格间来回移动光标；回车退出列表或引用后打的字不再并进下一段；标题开头回车在上方新开段落；代码块、表格、容器和分隔线旁的退格与 Delete 不再破坏结构；左右方向键越过分隔线和渲染预览；Firefox 中在行尾的加粗、链接等格式后打字留在格式外。

- Typing Chinese with an input method in a heading no longer jumps to the start of the heading in Safari and WebKit desktop apps.

  在 Safari 与 WebKit 桌面端的标题里用输入法打中文，拼音不再跳到标题开头。

- Input-method composition follows the ProseMirror and CodeMirror precedents more closely: pasting while a composition is open is left to the browser, a composition whose end the browser never reported also ends when the editor loses focus, and editing above a heading no longer rebuilds its fold control, so nearby components stay mounted while composing and undoing.

  输入法组字更贴近 ProseMirror 与 CodeMirror 的做法：组字过程中粘贴交给浏览器处理；浏览器没有报告组字结束时，编辑器失焦也会结束组字；在标题上方编辑不再重建其折叠按钮，组字与撤销时附近组件保持不动。

- Typing Chinese with an input method in a new empty list item in Chrome no longer leaves the first pinyin letter in the text.

  在 Chrome 的新空列表项里用输入法打中文，不再把第一个拼音字母留在正文里。

- Render further ahead while scrolling through the new `EditorView.scrollViewportMargin` facet, paint text-like placeholders on ranges that are not rendered yet, and limit selection-match highlights to source mode, so fast scrolling flashes white less and selecting stays responsive.

  通过新增的 `EditorView.scrollViewportMargin` 在滚动时往前多绘制，在尚未渲染的区域显示文本状占位，并把相同文本高亮限定在源码模式，减少快速滚动闪白，选区也更跟手。

- Mouse selection edge scrolling now advances on animation frames while preserving its existing speed across refresh rates. Releasing the pointer settles the actual endpoint, and cancellation, window blur or destruction stops pending scrolling and stale selection work.

  鼠标拖选到视口边缘后改为按动画帧滚动，并保持不同刷新率下的原有速度。松手时使用真实释放位置确定选区端点，取消、窗口失焦或销毁后停止待执行的滚动与旧选区更新。

- When WebKit drops the end of an input-method composition, editing recovers on the next key, pointer press or blur instead of staying in composition mode, so drag selection, list editing and the current block highlight keep working; the highlight also stays on the block while its text is being composed, and an empty-row hint never draws over the row above.

  WebKit 丢失输入法组字的结束事件时，编辑器会在下一次按键、鼠标按下或失焦时恢复，不再卡在组字状态，拖选、列表编辑和当前块高亮都能正常工作；组字期间当前块高亮保持显示，空行提示也不会再压在上一行上。

# @quirekit/msfe-heading

## 0.0.2

### Patch Changes

- A `#` typed without its space now stays visible as text and becomes a heading when the space is typed, instead of switching to heading size before the space.

  只输入 `#`、还没输入空格时按文字显示，输入空格后才变成标题；之前会在输入空格前就切换成标题字号。

- Input-method composition follows the ProseMirror and CodeMirror precedents more closely: pasting while a composition is open is left to the browser, a composition whose end the browser never reported also ends when the editor loses focus, and editing above a heading no longer rebuilds its fold control, so nearby components stay mounted while composing and undoing.

  输入法组字更贴近 ProseMirror 与 CodeMirror 的做法：组字过程中粘贴交给浏览器处理；浏览器没有报告组字结束时，编辑器失焦也会结束组字；在标题上方编辑不再重建其折叠按钮，组字与撤销时附近组件保持不动。

- Typing in the visual view no longer inserts or removes elements: block controls stay mounted, heading fold controls and table rows are not redrawn when text before them moves. This keeps input fast in host pages with expensive `:has()` rules.

  可视模式打字时不再增删元素：块手柄保持挂载，标题折叠按钮和表格行不会因为前文位移而重绘。宿主页面带有开销较大的 `:has()` 规则时，输入依然流畅。

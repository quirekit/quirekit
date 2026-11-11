# @quirekit/block-editor

## 0.0.3

### Patch Changes

- Ship the command and AI capability typings that were missing from the published declarations, so `editor.commands` type-checks the HTML sandbox commands and the Block Editor footnote, math, code, attachment, web card and definition commands without extra setup.

  补上已发布类型声明中缺失的命令与 AI 能力类型，`editor.commands` 调用 HTML 沙箱命令，以及 Block Editor 的脚注、公式、代码、附件、网页卡片和定义命令时，不再需要额外声明。

## 0.0.2

### Patch Changes

- The Block editor now declares how its content merges in collaboration, and block identities are no longer rewritten when a peer receives a collaborative change. Numbering and table merge rules live in the shared models, so Classic and Block use the same ones.

  Block 编辑器现在声明了协同时内容如何合并，成员收到协同改动时不再改写块身份。编号与表格的合并规则放在共享模型包中，Classic 与 Block 共用。

- Classic and Block editors now share the Markdown editor's block handle: one chip with a colored block-type mark and a muted grip. Classic shows its insert button only on empty paragraphs; other blocks insert through the handle menu. Dragging a block now shows the grabbing cursor everywhere. New `QuireBlockHandle` component.

  Classic 与 Block 编辑器的块拖拽手柄统一为 Markdown 编辑器的样式：一个按钮内显示带颜色的块类型标记和弱化的拖拽点。Classic 的插入按钮只在空段落显示，其他块通过手柄菜单插入。拖动块时光标始终显示为抓取状态。新增 `QuireBlockHandle` 组件。

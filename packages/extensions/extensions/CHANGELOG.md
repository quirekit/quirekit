# @quirekit/extensions

## 0.0.3

## 0.0.2

### Patch Changes

- The Block editor now declares how its content merges in collaboration, and block identities are no longer rewritten when a peer receives a collaborative change. Numbering and table merge rules live in the shared models, so Classic and Block use the same ones.

  Block 编辑器现在声明了协同时内容如何合并，成员收到协同改动时不再改写块身份。编号与表格的合并规则放在共享模型包中，Classic 与 Block 共用。

- The undo-redo extension adds a `clearHistory` command that forgets every undo and redo step without changing the document, for hosts that replace or withdraw local work, such as a collaboration reset.

  撤销重做扩展新增 `clearHistory` 命令，在不改动文档的前提下清空全部撤销与重做步骤，供协同重置等替换或撤回本地内容的宿主使用。

- Typing in long documents does less work per keystroke. The delete observer no longer replays a transaction that removed nothing, and the block catalog collects block facts on first use instead of on every document change.

  长文档中每次按键的计算量更小：删除观察器不再重放未删除任何内容的事务，块目录改为首次读取时才收集块信息，而不是每次文档变化都重建。

# @quirekit/layout

## 0.0.2

### Patch Changes

- An inline object whose source node spans several positions, such as a phonetic guide holding base text, now ends its fragment and caret stops after the whole node. Clicking after the guide places the caret beside it, so typed and IME text no longer enters the guide's base text.

  源节点占多个位置的内联对象（如带底字的拼音指南）现在把片段和光标停靠点的终点放在整个节点之后。点击拼音后方时光标落在它旁边，键入和输入法文字不再进入拼音的底字。

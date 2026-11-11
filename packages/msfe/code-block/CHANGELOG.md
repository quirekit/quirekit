# @quirekit/msfe-code-block

## 0.0.3

## 0.0.2

### Patch Changes

- Fences typed through an input method now get their closing fence too, and the new `toggleCodeBlock()` command (Mod-Alt-C) turns lines into a code block or back into text without a half-typed fence ever pairing with a block below.

  用输入法打出的围栏也会自动补上闭合围栏；新增 `toggleCodeBlock()` 命令（Mod-Alt-C），可把行转为代码块或还原成正文，不会出现半个围栏和下方代码块配对的情况。

- Typing your own closing fence inside a code block no longer turns the completed closer into a new opener that swallows the blocks below.

  在代码块里自己打出闭合围栏时，自动补上的闭合围栏不再变成新的开头围栏、吞掉下方的代码块。

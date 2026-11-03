# @quirekit/view

[English](./README.md) | 简体中文

QuireKit 的文档显示与输入层。它负责把文档画出来，处理鼠标选区、光标、输入法和滚动，并把用户操作交回编辑器核心。

## 安装

```bash
npm install @quirekit/view
```

## 使用方式

自建编辑器时，将 `canvasViewExtension()` 或 `svgViewExtension()` 加入 Core 扩展列表，并选择对应的 `mode`。连续流 HTML 显示由 [`@quirekit/view-html`](../view-html/README.zh-CN.md) 提供。现成应用通常直接使用 Classic 或 Block Editor。

## 使用时注意

- 引入 `@quirekit/view/styles.css`，并为挂载容器设置明确尺寸。
- 本包负责显示和输入，不定义 Word 文档结构。页面、段落和表格的排版规则由文档功能包提供。
- 同一份文档的不同显示方式应共用 Core 实例；销毁实例时释放已挂载视图。

## 相关说明

- [编辑器核心](../core/editor/README.zh-CN.md)
- [Classic 产品入口](../classic-editor/README.zh-CN.md)
- [Block 产品入口](../block-editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

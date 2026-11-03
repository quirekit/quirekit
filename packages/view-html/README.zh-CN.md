# @quirekit/view-html

[English](./README.md) | 简体中文

QuireKit 的连续流 HTML 显示层。它用浏览器排版显示文档，同时由 QuireKit 管理输入、光标和选区，适合评论、聊天、块编辑器等不分页的场景。

## 安装

```bash
npm install @quirekit/view-html
```

## 使用方式

将 `htmlViewExtension({ runtime })` 加入 Core 扩展列表，并用 `mode: "html"` 挂载。现成的块编辑器可以直接使用 [Block 产品入口](../block-editor/README.zh-CN.md)。

## 使用时注意

- 这是 retained HTML 视图，不同于 `@quirekit/dom-view` 的原生 contenteditable，两者的输入和几何处理不同。
- 不提供分页显示；分页文档使用 [`@quirekit/view`](../view/README.zh-CN.md) 的 Canvas 或 SVG 视图。

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

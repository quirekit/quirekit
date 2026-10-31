# @quirekit/md-editor-comments

[English](./README.md) | 简体中文

为 Md Editor 提供评论：划词评论、回复、解决、@ 提及、全文评论、宽屏右侧评论栏与评论列表，以及 CriticMarkup 文件导入导出。评论不写进 Markdown，由应用自行保存。

## 安装

```bash
npm install @quirekit/md-editor-comments@alpha
```

## 使用方式

```ts
import { mdComments } from "@quirekit/md-editor-comments";
import "@quirekit/md-editor-comments/styles.css";

const comments = mdComments({ user: { id: "lin", name: "小林" }, onChange: change => save(change.snapshot()) });
```

把 `comments` 传给 `MdEditor` 的 `comments`。读取或导入评论数据时，用 `@quirekit/msfe-comments` 的 `getComments(editor)`。

## 使用时注意

- 不传 `comments` 时，Md Editor 不显示任何评论入口。
- `criticMarkup` 默认关闭；`documentComments: "end"` 在正文末尾显示全文评论区。

## 相关说明

- [Md Editor](../editor/README.zh-CN.md)
- [评论数据与锚点](../../msfe/comments/README.zh-CN.md)

## 许可

[商业许可](./LICENSE.md)：开发与评估免费，生产使用需要授权码；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

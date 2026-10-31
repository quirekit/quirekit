# @quirekit/msfe-comments

[English](./README.md) | 简体中文

给 Markdown 文档增加评论、回复、解决状态和文字引用位置。

## 安装

```bash
npm install @quirekit/msfe-comments@alpha
```

## 使用方式

用 Comments.configure({ user, ... }) 配置当前用户，再加入 extensions。通过 getComments(editor) 取得评论控制器。应用提供侧栏、通知和存储；用 onChange 回调取得需要保存的评论快照。

## 使用时注意

- 评论单独保存，不塞进 Markdown 正文。重新打开文档时，需要同时恢复正文和对应评论。

## 相关说明

- [MSFE 使用说明](../core/README.zh-CN.md)

## 许可

[商业许可](./LICENSE.md)：开发与评估免费，生产使用需要授权码；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

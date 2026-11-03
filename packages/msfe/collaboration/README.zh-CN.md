# @quirekit/msfe-collaboration

[English](./README.md) | 简体中文

让多个用户共同编辑同一份 Markdown，处理同步、协同撤销以及会话恢复。

## 安装

```bash
npm install @quirekit/msfe-collaboration
```

## 使用方式

先用 createCollaborationSession 创建会话，再把 Collaboration 扩展接入 MSFE。应用提供文档身份、服务连接和保存恢复方式；服务器必须实现当前会话协议，不能只给一个任意 WebSocket 地址。

## 使用时注意

- 共同编辑与服务器持久保存是不同能力。界面应显示连接、同步和保存状态，不把已同步等同于已经落盘。

## 相关说明

- [MSFE 使用说明](../core/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

# @quirekit/msfe-collaboration-hocuspocus

[English](./README.md) | 简体中文

把 MSFE 协同会话接到 Hocuspocus 服务。

## 安装

```bash
npm install @quirekit/msfe-collaboration-hocuspocus
```

## 使用方式

调用 hocuspocusProvider({ url, sessionEndpoint, token }) 得到 provider，再交给 msfe-collaboration。url 是 WebSocket 地址，sessionEndpoint 是应用的 HTTP 会话入口；该入口返回文档身份、房间和恢复信息。

## 使用时注意

- 仅有默认 Hocuspocus 服务还不够，应用需要补齐会话准入和持久化接口。

## 相关说明

- [MSFE 使用说明](../core/README.zh-CN.md)
- [协同会话](../collaboration/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

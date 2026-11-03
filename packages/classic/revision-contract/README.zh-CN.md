# @quirekit/classic-revision-contract

[English](./README.md) | 简体中文

供扩展声明哪些数据需要参与 Word 修订。仅需描述修订数据的扩展可以依赖它，不必加载完整修订引擎。

## 安装

```bash
npm install @quirekit/classic-revision-contract
```

## 使用方式

开发可追踪修订的扩展时，使用本包提供的 addWordRevisions 类型及属性工具。实际记录、接受和拒绝修订由 classic-revision 处理；普通应用通常通过 Classic Word 预设使用这些功能。

## 使用时注意

- 本包不是修订面板，也不单独开启修订跟踪。

## 相关说明

- [修订处理](../revision/README.zh-CN.md)
- [审阅界面](../../classic-pro/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

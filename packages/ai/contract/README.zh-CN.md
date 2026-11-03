# @quirekit/ai-contract

[English](./README.md) | 简体中文

扩展向 AI 描述自己的类型合同。扩展用 `addAiCapabilities()` 声明可读的格式、内容块、结构角色与源码块，第三方 Agent 也可以按这份合同对接 QuireKit 文档。

## 安装

```bash
npm install @quirekit/ai-contract
```

## 使用方式

只用 `import type` 引入。引入后，`addAiCapabilities` 会出现在 `Extension`、`Node`、`Mark` 的配置类型中：

```ts
import type { QuireAiCapability } from "@quirekit/ai-contract";
```

## 使用时注意

- 这个包只有类型，不含运行时代码；读取文档、执行编辑和校验由 `@quirekit/ai-runtime` 完成。

## 相关说明

- [AI 运行时](../runtime/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)

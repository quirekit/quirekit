# @quirekit/ui

[English](./README.md) | 简体中文

QuireKit 共用的界面组件与主题工具，包含按钮、输入框、弹窗、菜单、表格等。可以独立用于 Vue 应用。

## 安装

```bash
npm install @quirekit/ui
```

使用本包还需要：`@ark-ui/vue` (^5.39.1)。

## 使用方式

Vue 组件从 `/vue` 导入，主题和浏览器工具从根入口导入。下面的样式还需安装 `@quirekit/unocss-preset`。

```vue
<script setup lang="ts">
import { QuireButton } from '@quirekit/ui/vue'
import '@quirekit/unocss-preset/quirekit.css'
</script>

<template>
  <QuireButton>Save</QuireButton>
</template>
```

## 使用时注意

- 组件介绍和示例位于仓库的 `apps/design` 文档站。
- 主题颜色、字号和间距可以统一配置；产品接入应沿用一套主题，避免每个组件各自修改。

## 相关说明

- [组件样式](../unocss-preset/README.zh-CN.md)
- [组件文档站](../../apps/design/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

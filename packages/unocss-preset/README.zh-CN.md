# @quirekit/unocss-preset

[English](./README.md) | 简体中文

QuireKit UI 的样式和 UnoCSS 预设。可以直接引入编译好的 CSS，也可以接入已有的 UnoCSS 构建。

## 安装

```bash
npm install @quirekit/unocss-preset
```

## 使用方式

不使用 UnoCSS 的应用，直接引入下面的样式即可。使用 UnoCSS 时可通过 `presetQuireKit()` 或 `defineQuireKitUnoConfig()` 配置。

```ts
import '@quirekit/unocss-preset/quirekit.css'
```

## 使用时注意

- CSS 提供外观；Vue 组件仍从 `@quirekit/ui/vue` 导入。

## 相关说明

- [界面组件](../ui/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

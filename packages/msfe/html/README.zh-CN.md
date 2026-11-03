# @quirekit/msfe-html

[English](./README.md) | 简体中文

在 MSFE 中识别 HTML 片段，并按设置显示经过净化的静态内容。

## 安装

```bash
npm install @quirekit/msfe-html
```

## 使用方式

把 Html 加入 extensions。用 setHtmlRendering 切换显示方式；显示设置不会改写 Markdown 原文。需要运行脚本的 HTML 示例时，应另用 html-sandbox。

## 使用时注意

- 静态 HTML 预览不会执行脚本；图片等资源是否允许加载由应用策略决定。

## 相关说明

- [MSFE 使用说明](../core/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

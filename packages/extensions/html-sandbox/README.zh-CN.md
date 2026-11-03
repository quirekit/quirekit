# @quirekit/extension-html-sandbox

[English](./README.md) | 简体中文

在富文本文档中保存 HTML 示例，并按应用的设置提供隔离预览。

## 安装

```bash
npm install @quirekit/extension-html-sandbox
```

## 使用方式

将 HtmlSandbox 加入 Core。用 html-sandbox 配置独立的预览运行页面；Vue 集成可从本包的 /vue 入口选择。应用明确决定是否启用预览，HTML 内容不能调用编辑器命令。

## 使用时注意

- 只安装文档扩展不等于已经部署预览运行页面。
- 应保存 HTML 源码；预览的运行状态不是正文。

## 相关说明

- [部署预览运行页面](../../html-sandbox/README.zh-CN.md)
- [公共预览组件](../../ui/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

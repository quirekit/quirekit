# @quirekit/msfe-html-sandbox

[English](./README.md) | 简体中文

在 MSFE 中保存可隔离运行的 HTML 示例，源码放在 html-preview 围栏里。

## 安装

```bash
npm install @quirekit/msfe-html-sandbox
```

## 使用方式

把 MsfeHtmlSandbox 加入 extensions，并配置 html-sandbox 的运行页面及预览组件。readHtmlSandboxSource 和 patchHtmlSandboxSource 用于读取或修改对应围栏。

## 使用时注意

- 应用明确允许后才运行预览；HTML 预览不能直接修改 Markdown 编辑器。

## 相关说明

- [MSFE 使用说明](../core/README.zh-CN.md)
- [部署 HTML 预览](../../html-sandbox/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

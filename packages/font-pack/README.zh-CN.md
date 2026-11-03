# @quirekit/font-pack

[English](./README.md) | 简体中文

QuireKit 可选的开源字体资源。应用可以按需加载中文、拉丁文字和等宽字体，也可提供给文件导出使用。

## 安装

```bash
npm install @quirekit/font-pack
```

## 使用方式

只引入需要的字体样式；下面启用 Carlito。引入 CSS 后，仍需在应用或文档样式中选择相应字体。

```ts
import '@quirekit/font-pack/carlito.css'
```

## 使用时注意

- 其他样式包括 `noto-sans-sc.css`、`noto-serif-sc.css`、`lxgw-wenkai.css`、`zhuque-fangsong.css` 和 `jetbrains-mono.css`。
- PDF 字体资源从 `/pdf`、浏览器加载工具从 `/pdf/browser` 使用。浏览器 CSS 字体与导出字体需要分别配置。
- 各字体有自己的许可文件，随资源位于 `licenses` 中。

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

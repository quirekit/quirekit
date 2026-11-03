# @quirekit/font-pack

English | [简体中文](./README.zh-CN.md)

Optional open font assets for QuireKit. Applications can load Chinese, Latin and monospace fonts as needed, including fonts used for file export.

## Installation

```bash
npm install @quirekit/font-pack
```

## Usage

Import only the font styles you need. This enables Carlito; select the font in your application or document styles after importing the CSS.

```ts
import '@quirekit/font-pack/carlito.css'
```

## Things to know

- Other styles include `noto-sans-sc.css`, `noto-serif-sc.css`, `lxgw-wenkai.css`, `zhuque-fangsong.css` and `jetbrains-mono.css`.
- Use `/pdf` for PDF font resources and `/pdf/browser` for browser loading helpers. Configure browser CSS fonts and export fonts separately.
- Each font has its own license file under `licenses`.

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

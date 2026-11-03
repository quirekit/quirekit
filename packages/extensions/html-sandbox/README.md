# @quirekit/extension-html-sandbox

English | [简体中文](./README.zh-CN.md)

Stores HTML examples in rich-text documents and provides isolated previews under application policy.

## Installation

```bash
npm install @quirekit/extension-html-sandbox
```

## Usage

Install HtmlSandbox in Core and configure a separate runner page through html-sandbox. Vue integration is available from this package’s /vue entry. Your application explicitly enables previews; embedded HTML cannot call editor commands.

## Things to know

- Installing the extension does not deploy the preview runner.
- Persist the HTML source; the preview’s runtime state is not document content.

## Related documentation

- [Deploying the runner](../../html-sandbox/README.md)
- [UI preview component](../../ui/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

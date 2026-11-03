# @quirekit/html

English | [简体中文](./README.zh-CN.md)

Converts between HTML and QuireKit document JSON using your installed document extensions. Only nodes and formatting understood by those extensions can be represented.

## Installation

```bash
npm install @quirekit/html
```

## Usage

This example runs in a browser and also needs `@quirekit/starter-kit`.

```ts
import { generateHTML, generateJSON } from '@quirekit/html'
import { StarterKit } from '@quirekit/starter-kit'

const content = generateJSON('<p>Hello <strong>world</strong></p>', [StarterKit])
console.log(generateHTML(content, [StarterKit]))
```

## Things to know

- Use the `/server` entry in Node; it creates and releases a server DOM for each conversion.
- HTML conversion is not a web page runner. Use HTML Sandbox to execute HTML examples.

## Related documentation

- [Document core](../editor/README.md)
- [HTML preview runner](../../html-sandbox/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

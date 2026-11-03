# @quirekit/incremark-react

English | [简体中文](./README.zh-CN.md)

Incremark’s React reader for Markdown articles and streaming AI responses. It shares Markdown parsing rules with the Vue version.

## Installation

```bash
npm install @quirekit/incremark-react
```

The consuming project also needs: `react` (^19.3.0), `react-dom` (^19.3.0).

## Usage

Pass the full current Markdown text from your React page.

```tsx
import { QuireMarkdown } from '@quirekit/incremark-react'
import '@quirekit/incremark-react/styles.css'

export default function Article() {
  return <QuireMarkdown content={'# Hello\n\nThis is **Markdown**.'} />
}
```

## Things to know

- For streaming, pass accumulated text and set `status`. Use a new `identity` for a new message.
- This component is for reading. Use MSFE React for editable Markdown documents.

## Related documentation

- [Parser core](../incremark-core/README.md)
- [React editor](../msfe/react/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/cm-lang-css

English | [简体中文](./README.zh-CN.md)

Adds CSS language support to CodeMirror.

## Installation

```bash
npm install @quirekit/cm-lang-css
```

## Usage

Call `css()` to create a language extension and add it to CodeMirror’s extensions. This example creates the editing state; pass it to cm-view for a UI. Also install cm-state.

```ts
import { EditorState } from '@quirekit/cm-state'
import { css } from '@quirekit/cm-lang-css'

const state = EditorState.create({
  doc: "body { color: red; }",
  extensions: [css()],
})
console.log(state.doc.toString())
```

## Things to know

- Language support does not execute source code.
- Use @quirekit/cm-* for state, view and language extensions in the same editor; do not mix them with official @codemirror/* instances.

## Related documentation

- [Mounting the editor](../view/README.md)
- [Markdown editor](../../msfe/core/README.md)

## Source origin

Based on `@codemirror/lang-css` 6.3.1. See [UPSTREAM.json](./UPSTREAM.json) for the source revision and local changes.

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

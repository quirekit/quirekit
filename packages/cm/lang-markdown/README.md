# @quirekit/cm-lang-markdown

English | [简体中文](./README.zh-CN.md)

Adds Markdown language support to CodeMirror.

## Installation

```bash
npm install @quirekit/cm-lang-markdown
```

## Usage

Call `markdown()` to create a language extension and add it to CodeMirror’s extensions. This example creates the editing state; pass it to cm-view for a UI. Also install cm-state.

```ts
import { EditorState } from '@quirekit/cm-state'
import { markdown } from '@quirekit/cm-lang-markdown'

const state = EditorState.create({
  doc: "# Hello",
  extensions: [markdown()],
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

Based on `@codemirror/lang-markdown` 6.5.2. See [UPSTREAM.json](./UPSTREAM.json) for the source revision and local changes.

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/cm-state

English | [简体中文](./README.zh-CN.md)

Stores CodeMirror text, selections and extension settings, with transactions producing new states.

## Installation

```bash
npm install @quirekit/cm-state
```

## Usage

Create state with EditorState.create({ doc, extensions }) and describe edits with state.update(...). Text is stored in state.doc.

```ts
import { EditorState } from '@quirekit/cm-state'

const state = EditorState.create({ doc: 'Hello' })
const next = state.update({ changes: { from: 5, insert: ' QuireKit' } }).state
console.log(next.doc.toString())
```

## Things to know

- Maintained from `@codemirror/state` 6.7.6; UPSTREAM.json records its origin and local changes.
- Use @quirekit/cm-* consistently within an editor rather than mixing official @codemirror/* instances.

## Related documentation

- [Markdown editor using these packages](../../msfe/core/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

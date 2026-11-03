# @quirekit/cm-view

English | [简体中文](./README.zh-CN.md)

Displays CodeMirror state as an editable browser surface.

## Installation

```bash
npm install @quirekit/cm-view
```

## Usage

Mount EditorView in the browser. Your application sizes the container and calls destroy() on disposal. Also install cm-state.

```ts
import { EditorState } from '@quirekit/cm-state'
import { EditorView } from '@quirekit/cm-view'

const parent = document.createElement('div')
document.body.append(parent)
const view = new EditorView({ state: EditorState.create({ doc: 'Hello' }), parent })
// Call view.destroy() when the editor is no longer needed.
```

## Things to know

- Maintained from `@codemirror/view` 6.43.13; UPSTREAM.json records its origin and local changes.
- Use @quirekit/cm-* consistently within an editor rather than mixing official @codemirror/* instances.

## Related documentation

- [Markdown editor using these packages](../../msfe/core/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

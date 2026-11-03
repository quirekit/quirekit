# @quirekit/msfe-react

[中文](README.zh-CN.md)

React integration for MSFE, using components and hooks to mount and clean up Markdown editors and React component views.

## When to use it

- Use it to embed a Markdown editing surface in React and run commands from your own UI.
- MSFE keeps Markdown source authoritative. Live presentation displays that source rather than storing a second WYSIWYG document.
- It is not a controlled input that sends full text through `value` / `onChange` on every keystroke.
- It supplies no complete toolbar. Use [msfe-core](../core/README.md) for framework-neutral APIs or [msfe-vue](../vue/README.md) for Vue.

## Installation

```bash
npm install @quirekit/msfe-react @quirekit/msfe-core @quirekit/msfe-starter-kit react@^19.3.0 react-dom@^19.3.0
```

```bash
pnpm add @quirekit/msfe-react @quirekit/msfe-core @quirekit/msfe-starter-kit react@^19.3.0 react-dom@^19.3.0
```

Both peer dependencies are required: `react: ^19.3.0` and `react-dom: ^19.3.0`. Core is a regular dependency, installed explicitly because the example imports its types. StarterKit is the example's feature preset, not a peer dependency. Packages expose ESM exports.

TypeScript projects also need matching type packages:

```bash
npm install --save-dev @types/react@^19.3.0 @types/react-dom@^19.3.0
```

The pnpm equivalent is `pnpm add -D @types/react@^19.3.0 @types/react-dom@^19.3.0`. In an existing app, check that dependency and type versions match.

## Minimal example

In a browser project already configured for React, TypeScript, and JSX, put this component in `App.tsx` and render it from your existing page entry. No extra UI library or theme CSS import is required.

```tsx
import { useRef, useState } from 'react'
import type { MsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { MsfeEditorContent, type ReactEditorOptions } from '@quirekit/msfe-react'

/** @returns Editable Markdown with an explicit read button. */
export default function App() {
  const editor = useRef<MsfeEditor | null>(null)
  const [saved, setSaved] = useState('')
  const [revision, setRevision] = useState(0)
  const options: ReactEditorOptions = {
    documentId: 'note-1',
    markdown: '# Hello React\n\nEdit this **Markdown**.\n',
    mode: 'live',
    extensions: [StarterKit],
    onChange: event => setRevision(event.revision),
    onError: error => console.error(error),
  }

  return (
    <section>
      <button type="button" onClick={() => setSaved(editor.current?.getMarkdown() ?? '')}>
        Read Markdown
      </button>
      <span>Revision: {revision}</span>
      <MsfeEditorContent options={options} onReady={instance => { editor.current = instance }} />
      <pre>{saved}</pre>
    </section>
  )
}
```

Edit the document and click the button to display its current Markdown below. Here `onChange` only updates a revision number, not a copy of the whole document. The component creates the editor in an effect and destroys it automatically on unmount.

## Core concepts

1. **Initial options**: configuration is read once per mount. Ordinary React renders do not recreate the editor, and a new options object does not synchronize content.
2. **Editor reference**: `onReady` runs once the instance is available. `useRef` retains it without putting CodeMirror state into React's deep state management; the reference is `null` before mounting.
3. **Source and presentation**: `getMarkdown()` reads authoritative text. `source`, `live`, and `locked` share a document and history; `locked` prevents editing, and `readOnly` controls editability separately.
4. **Component host**: React component views use portals into the editor while preserving application context. CodeMirror still owns body DOM and input.
5. **Effect lifetime**: development StrictMode may replay setup and cleanup, so `onReady` can run more than once. Do not treat it as a globally once-only event.

## Common tasks

Except for the final standalone component, define these functions inside the main example's `App`, before `return`, and connect them to your buttons. Do not execute editing commands directly during render.

### Run a command from a button

```ts
/** Toggle bold for the current selection or typing position. */
function toggleBold(): void {
  const instance = editor.current
  if (instance && !instance.commands.toggleBold()) {
    console.warn(instance.lastCommandResult)
  }
}
```

Use `onClick={toggleBold}` on a button. StarterKit installs this command. It returns a boolean, with failure details in `lastCommandResult`.

### Switch documents

```ts
/** Open another document, clearing the old selection and undo history. */
function openAnotherNote(): void {
  const result = editor.current?.replaceDocument('# Another note\n', 'note-2')
  if (result && !result.ok) console.warn(result.reason)
}
```

Do not feed every local change back through `replaceDocument()` in an effect; that continually clears history. For a text edit within the current document, use Core's versioned `applyChanges()`.

### Change mode, read-only state, and theme

```ts
/** Show read-only source using the dark theme. */
function showReadOnlySource(): void {
  editor.current?.setMode('source')
  editor.current?.setReadOnly(true)
  editor.current?.setTheme('dark')
}
```

Use `setReadOnly(false)` to restore input; if mode is `locked`, also switch to `source` or `live`. There is no need to recreate the instance by changing its React `key`.

### Consume incremental changes

Add the type import at file scope and define the handler inside `App`:

```ts
import type { MsfeChangeEvent } from '@quirekit/msfe-core'

/** @param event - Accepted source change without a full-text copy. */
function handleChange(event: MsfeChangeEvent): void {
  setRevision(event.revision)
  console.log({ origin: event.origin, changed: !event.changes.empty })
}
```

Set the initial options' `onChange` to `handleChange` instead of the original callback. Running options do not track changing React state. If a callback needs changing application values, your application can expose the latest values through a stable ref. Read full Markdown with `getMarkdown()` only in explicit actions.

### Own the mount layout

Use this component **instead of** the main example's editing area; do not mount another `MsfeEditorContent` alongside it:

```tsx
import { useRef } from 'react'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { useMsfeEditor, ReactNodeViewHost } from '@quirekit/msfe-react'

/** @returns A custom mount area and its component-view host. */
export function CustomEditor() {
  const parent = useRef<HTMLDivElement>(null)
  const session = useMsfeEditor(parent, () => ({
    markdown: '# Custom mount\n',
    mode: 'live',
    extensions: [StarterKit],
  }))

  return (
    <section>
      <button type="button" disabled={!session} onClick={() => session?.editor.undo()}>Undo</button>
      <div ref={parent} />
      {session && <ReactNodeViewHost host={session.host} />}
    </section>
  )
}
```

`session` is `null` before mounting. The hook owns creation and destruction for each effect lifetime, while `ReactNodeViewHost` renders component views. Do not repeatedly create instances in ref callbacks or manually destroy an instance borrowed from the hook.

## Related packages

| Package | Responsibility |
| --- | --- |
| [@quirekit/msfe-core](../core/README.md) | Markdown, commands, history, document identity, and revisions |
| [@quirekit/msfe-starter-kit](../starter-kit/README.md) | Default syntax and presentation that can be disabled or replaced |
| `@quirekit/msfe-react` | `MsfeEditorContent`, `useMsfeEditor`, and React component-view integration |
| [@quirekit/msfe-vue](../vue/README.md) | Vue integration; not needed in a React application |

## Current limitations

- `0.x` alpha is not stable. React / React DOM peers require `^19.3.0`; earlier versions are not promised compatible.
- This is not a controlled input. There is no `value` / `onChange` protocol returning full Markdown on every input, and options do not update automatically.
- Browser effects create the editor; server rendering does not produce complete static Markdown reading content.
- Initialization failures such as invalid extension configuration can throw into React. Use your application's error boundary rather than treating `onError` as a catch-all for initialization.
- Your application supplies toolbars, storage, uploads, and resource permissions. Custom component views must not take over CodeMirror's body DOM. See Core / StarterKit for syntax limits.

## License

MIT. See [LICENSE.md](LICENSE.md). Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

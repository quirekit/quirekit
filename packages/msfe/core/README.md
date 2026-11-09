# @quirekit/msfe-core

[中文](README.zh-CN.md)

A CodeMirror-based Markdown source editor core with switchable source and live presentations that preserve the underlying text.

## When to use it

- Use it when Markdown files or strings are your saved content and you want control over commands and UI.
- **Source-first** means Markdown text is the sole authority, not a separately stored rich-text tree. Live presentation changes display without repeatedly converting and rewriting the source.
- Unlike a WYSIWYG editor, it still exposes Markdown markers during editing. Unsupported syntax remains source text; not every construct has a visual presentation.
- It is not for arbitrary rich-text JSON structures, a complete built-in toolbar, or letting a framework own the editable body DOM.

## Installation

The example also installs the default feature preset. Core has no peer dependencies to install separately and requires neither Vue nor React.

```bash
npm install @quirekit/msfe-core @quirekit/msfe-starter-kit
```

```bash
pnpm add @quirekit/msfe-core @quirekit/msfe-starter-kit
```

The package manager installs regular dependencies. For source editing without the preset's visual features, you can install Core alone. Packages expose ESM exports.

## Minimal example

Put this in a browser TypeScript project's entry, such as `src/main.ts`, and run it through your project's bundler. Core mounts CodeMirror itself; no separate QuireKit view package or theme CSS import is required.

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'

const parent = document.createElement('div')
document.body.append(parent)

const editor = createMsfeEditor({
  parent,
  documentId: 'note-1',
  markdown: '# Hello\n\n**Markdown** stays the source.\n',
  mode: 'live',
  extensions: [StarterKit],
  onError: error => console.error(error),
})

console.log(editor.getMarkdown())
```

An editable document appears on the page, and the console shows its Markdown source. Subsequent snippets reuse this `editor`. Mode defaults to `source`; omitting `extensions` does not install StarterKit automatically.

## Core concepts

1. **Source and positions**: the document is CodeMirror text. Logical offsets are zero-based UTF-16 units, excluding a leading BOM and counting CRLF as one internal newline. A BOM is an encoding marker at the start of some files.
2. **Presentation modes**: `source` shows source text; `live` presents supported syntax as formatting or components; `locked` is non-editable live presentation. They share one document and history. `readOnly` is a separate editability setting.
3. **Extensions and commands**: extensions install syntax, display, or commands. `commands` / `chain()` return booleans; `can()` checks applicability without changing the document.
4. **Document identity and revision**: `documentId` identifies the host's document; `revision` identifies an accepted instance version. External edits must state their version, and stale operations are rejected.
5. **Host and lifecycle**: your application owns loading, saving, and resource permissions. The Editor owns editing state and cleanup. Use `replaceDocument()` to switch documents and `destroy()` to dispose of the instance.

## Common tasks

### Observe changes and read the full text when needed

```ts
const unsubscribe = editor.onChange(({ documentId, revision, changes, origin }) => {
  console.log({ documentId, revision, changed: !changes.empty, origin })
})

const markdownToSave = editor.getMarkdown()
console.log(markdownToSave)
```

Change events contain incremental changes, not complete Markdown. Call `getMarkdown()` when a save button or your saving policy needs the full text, rather than copying it into framework state on every keystroke. Output preserves the input's uniform LF/CRLF convention and BOM.

### Run commands, inspect failures, and undo

```ts
const applicable = editor.can().toggleBold()
const accepted = editor.chain().setHeading(2).toggleBold().run()
if (!accepted) console.warn(editor.lastCommandResult)

console.log({ applicable, active: editor.isActive('bold') })
editor.undo()
editor.redo()
```

This example's StarterKit installs `setHeading()` and `toggleBold()`. A chain commits once, only if every step succeeds. `lastCommandResult` supplies rejection details. Do not treat the boolean return value as an object with an `ok` field.

### Distinguish editing a document from switching documents

Use `applyChanges()` for external text edits to the current document:

```ts
const documentId = editor.documentId
const baseRevision = editor.revision

const changeResult = editor.applyChanges({
  documentId,
  baseRevision,
  changes: { from: 0, insert: 'Introduction\n\n' },
  origin: 'host-edit',
})
if (!changeResult.ok) console.warn(changeResult.reason)
```

For asynchronous work, capture identity and revision when starting the request and submit those same values. Do not replace them with the latest revision to hide a conflict. External edits do not enter the user's undo stack.

To open another document or explicitly reset content:

```ts
const replaceResult = editor.replaceDocument('# Another note\n', 'note-2')
if (!replaceResult.ok) console.warn(replaceResult.reason)
```

This resets selection and undo history. It is not a controlled-value synchronization API to call on every framework render.

### Change display, editability, and theme

```ts
editor.setMode('source')
editor.setMode('live')
editor.setReadOnly(true)
editor.setTheme('dark')
```

These settings do not rebuild the instance or create separate histories. Use `setReadOnly(false)` to restore input; `locked` mode also prevents editing. Mode changes requested during input-method composition are deferred.

### Add a keyboard shortcut extension

```ts
import { Extension } from '@quirekit/msfe-core'

const AppShortcuts = Extension.create({
  name: 'appShortcuts',
  /** @returns Keyboard shortcuts registered by this extension. */
  addKeyboardShortcuts() {
    return { 'Mod-Shift-y': () => this.editor.commands.insertText('Hello') }
  },
})

const initialExtensions = [StarterKit, AppShortcuts]
```

Use `initialExtensions` as `extensions` when creating the instance. This is MSFE's Extension, not the identically named type from `@quirekit/core`. Similar declaration styles do not make their underlying objects interchangeable.

### Unsubscribe and destroy

```ts
unsubscribe()
editor.destroy()
```

Run this during page or component cleanup. Invalid configuration can make editor creation throw; your application must still handle initialization failures. `onError` reports errors during operation.

## Performance

MSFE parses incrementally and renders only the visible part of the document, so typing cost grows slowly with document length. [MD Editor](../../md-editor/editor/README.md), the complete product built on MSFE, takes p50 5.5 ms, p90 6.0 ms, p95 6.8 ms and p99 7.9 ms from key press to the accepted document in a 1,000,000-character document made mostly of long paragraphs (Document view, Apple M3 Max, Chromium 149, excluding the operating system, input method and display). The method and full table are in its README, and `pnpm --filter @quirekit/msfe-docs performance:latency` reproduces it in the QuireKit repository.

## Related packages

| Package | Responsibility |
| --- | --- |
| [@quirekit/msfe-starter-kit](../starter-kit/README.md) | Configurable default Markdown feature set |
| [@quirekit/msfe-vue](../vue/README.md) | Vue mounting, cleanup, state subscriptions, and component views |
| [@quirekit/msfe-react](../react/README.md) | React mounting, cleanup, and component views |
| [@quirekit/core](../../core/editor/README.md) | Separate structured rich-text core, not a required MSFE dependency |

## Current limitations

- `0.x` alpha is an alpha. Public interfaces and support coverage are not stable, and complete visual conformance for every Markdown dialect is not promised.
- The default preset does not cover every syntax. Unprojected content falls back to source. Basic display support does not imply complex list/table interactions or arbitrary editable component bodies are supported.
- Input must be a decoded string with uniform LF or CRLF line endings. Mixed endings and bare CR are rejected.
- Stale targets are not automatically remapped to new revisions. Extensions cannot be freely hot-installed or removed at runtime.
- Mounting needs a browser DOM. Storage, uploads, a complete toolbar, and collaboration transport services are outside this package.
- Third-party CodeMirror extensions need the same `@quirekit/cm-*` state and view packages. Do not assume objects from another CodeMirror runtime are directly compatible.

## License

MIT. See [LICENSE.md](LICENSE.md). Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

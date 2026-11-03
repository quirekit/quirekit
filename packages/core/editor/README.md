# @quirekit/core

[中文](README.zh-CN.md)

QuireKit's rich-text editing core: it manages structured documents, extensions, and commands, while a separate view package supplies the editing surface.

## When to use it

- Use it when your application needs custom document structures, keyboard shortcuts, or a toolbar of its own.
- Extensions use Tiptap-compatible authoring patterns: `Extension.create()`, `Node.create()`, `Mark.create()`, and `.configure()`.
- It is not a complete editor UI in one package. Core has neither a toolbar nor a built-in page view.
- If Markdown source must remain your authoritative content, use the separate [MSFE editor](../../msfe/core/README.md) instead of this structured rich-text core.

## Installation

The browser example also installs the basic extension preset and the native DOM view. That view uses the browser's editable elements; it does not paginate content.

```bash
npm install @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

Or with pnpm:

```bash
pnpm add @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

Core has no peer dependencies to install separately. The other two packages are explicit dependencies of this example; the package manager installs Core's regular dependencies. Packages expose ESM exports.

## Minimal example

Put this in the page entry of an existing browser TypeScript project, such as `src/main.ts`. Run it through your project's bundler; bare package imports cannot simply be pasted into an unbundled HTML page.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { DomViewExtension } from '@quirekit/dom-view'

const element = document.createElement('div')
document.body.append(element)

const editor = new Editor({
  element,
  mode: 'dom',
  extensions: [StarterKit, DomViewExtension],
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

console.log(editor.getJSON())
```

An editable document appears on the page, and the console shows its initial JSON. Pair `mode: 'dom'` with `DomViewExtension`; omitting mode does not select that adapter automatically. The following snippets reuse this `editor`.

## Core concepts

1. **Editor**: the instance that owns document state and lifecycle. Without `element`, it can also run without a mounted interface.
2. **Schema, nodes, and marks**: a schema defines permitted document structures. Nodes represent content such as paragraphs and headings; marks represent text formatting such as bold. Extensions supply them.
3. **Extension**: a feature definition installed into an instance. `StarterKit` bundles common nodes, marks, and editing behaviors.
4. **Commands and transactions**: commands express editing intentions; transactions record their state changes. `commands`, `chain()`, and `can()` use the same installed command table.
5. **View adapter**: a separate implementation that connects the document to a page. Core owns state; the DOM view in this example owns browser input, selection, and display.

## Common tasks

### Run a command and check availability

```ts
const canToggleBold = editor.can().toggleBold()
const handled = editor.chain().toggleBold().run()
console.log({ canToggleBold, handled, active: editor.isActive('bold') })
```

`toggleBold()` comes from StarterKit's Bold extension. `can()` checks whether a command applies, not whether the caller has permission. A method appearing in TypeScript does not prove its extension is installed at runtime.

### Replace, read, and save content

```ts
editor.setContent({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Replacement' }] }],
})

const jsonToSave = JSON.stringify(editor.getJSON())
const plainText = editor.getText()
const html = editor.getHTML()
console.log({ jsonToSave, plainText, html })
```

JSON retains structures supported by the installed schema. Plain text loses formatting. HTML comes from extension serialization rules, not a snapshot of the editor's DOM. Your application owns storage and network requests.

### Subscribe to changes and unsubscribe

```ts
const logUpdate = () => console.log(editor.getJSON())
editor.on('update', logUpdate)

editor.commands.setHeading({ level: 2 })
editor.off('update', logUpdate)
```

This logs the whole document for demonstration. Avoid unconditional serialization or storage writes on every keystroke in large documents. `on()` does not return an unsubscribe function; pass the same callback to `off()`.

### Add an extension of your own

```ts
import { Extension } from '@quirekit/core'

const AppShortcuts = Extension.create({
  name: 'appShortcuts',
  /** @returns Keyboard shortcuts registered by this extension. */
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-y': () => this.editor?.commands.toggleBold() ?? false,
    }
  },
})

const initialExtensions = [StarterKit, DomViewExtension, AppShortcuts]
```

Pass `initialExtensions` as `extensions` when creating the instance, replacing the earlier array. `Mod` means Command on macOS and Control on other common desktop platforms. This is initialization configuration, not dynamic extension installation.

### Make it read-only, unmount, and destroy

```ts
editor.setEditable(false)
editor.unmount()
editor.destroy()
```

`setEditable(false)` disables user input; it is not a security lock on all programmatic writes. `unmount()` removes the view but keeps the document. Call `destroy()` when the instance is no longer needed. In Vue or React, do this during component cleanup, not immediately after creation.

## Related packages

| Package | Responsibility |
| --- | --- |
| [@quirekit/starter-kit](../starter-kit/README.md) | Preset of common rich-text nodes, marks, shortcuts, and history |
| [@quirekit/extensions](../../extensions/extensions/README.md) | Opt-in behaviors such as placeholders, counting, and undo |
| `@quirekit/dom-view` | Native DOM view used by this example (experimental) |
| [@quirekit/msfe-core](../../msfe/core/README.md) | Independent Markdown source editor; its Editor and extensions are not interchangeable with these |

## Current limitations

- `0.x` alpha releases are prereleases. APIs, types, and document-format contracts are not stable yet. Keep companion QuireKit packages on the same version.
- Compatible authoring patterns do not make every Tiptap plugin directly installable. For low-level ProseMirror objects, use QuireKit's `@quirekit/pm` exports rather than mixing runtime identities.
- Core with this DOM setup does not supply a complete product UI, pagination, file storage, or a real-time collaboration service.
- Browser mounting requires a real DOM. Do not execute this page entry during server rendering.
- Changing schemas requires your own migration of saved JSON. Unknown nodes and marks are not guaranteed to survive without loss.

## License

MIT. See [LICENSE.md](LICENSE.md). Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

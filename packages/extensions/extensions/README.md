# @quirekit/extensions

[中文](README.zh-CN.md)

Opt-in editing behaviors for `@quirekit/core`, including placeholders, content counting, undo history, and selection-related behavior.

## When to use it

- Use it to add a specific behavior to an existing Core editor.
- Install each feature explicitly. Importing the package does not enable every extension.
- It does not provide a complete set of document structures such as paragraphs and headings, or an editor you can mount directly.
- These extensions cannot be installed into MSFE, which has its own Markdown source extension system.

## Installation

Install this package alongside Core, the basic preset, and the native DOM view used by the example.

```bash
npm install @quirekit/extensions @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

```bash
pnpm add @quirekit/extensions @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

This package has no peer dependencies. The package manager installs regular dependencies; the other packages above are direct dependencies of the example. Packages expose ESM exports.

## Minimal example

Run this in a browser TypeScript project's entry, such as `src/main.ts`, through your project's bundler.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { DomViewExtension } from '@quirekit/dom-view'
import { CharacterCount, Placeholder } from '@quirekit/extensions'

const element = document.createElement('div')
element.className = 'quire-editor'
document.body.append(element)

const editor = new Editor({
  element,
  mode: 'dom',
  extensions: [
    StarterKit,
    DomViewExtension,
    CharacterCount.configure({ limit: 280 }),
    Placeholder.configure({ placeholder: 'Write something…' }),
  ],
  content: '<p></p>',
})

console.log(editor.getJSON())
```

Add this rule to your page styles to make the placeholder visible in an empty paragraph. Placeholder supplies attributes and classes; your application renders the label with CSS.

```css
.quire-editor .is-empty::before {
  content: attr(data-placeholder);
  color: #777;
  float: left;
  height: 0;
  pointer-events: none;
}
```

The editor now accepts input with a character-count limit of 280. Subsequent snippets reuse these imports and `editor`.

## Core concepts and extension list

1. A **behavior extension** adds commands, shortcuts, or state to an existing document; it does not supply every document node.
2. **Configuration** uses `Feature.configure(options)` to create a configured extension. Defining it alone does not alter a running editor.
3. **Storage** is extension-owned runtime data on an Editor instance, not your application's persistent storage.
4. A **decoration** adds display information without adding saved text. Placeholder, focus, and selection styling needs support from the view and your CSS.

All these extensions are exported from the package root. Only entries explicitly added to `extensions` are enabled.

| Extension | Purpose |
| --- | --- |
| `AutoCorrect` | Configured replacements for typed text and sentence capitalization |
| `BaseKeymap` | Basic editing keys |
| `BlockInteraction` | Block identities, structural ranges, and block commands; no drag controls |
| `CharacterCount` | Character and word counts, with an optional character limit |
| `Focus` | Styling information for the focused node |
| `Formatting` | Clear formatting, format painting, and composition of formatting providers |
| `Gapcursor` | Cursor positions between some block nodes |
| `Placeholder` | Placeholder attributes and classes on eligible empty nodes |
| `Selection` | Selection display information when the editor loses focus |
| `TextCase` | Case and halfwidth/fullwidth conversion commands |
| `TrailingNode` | An editable final node when needed |
| `UndoRedo` | Undo, redo, and history shortcuts |

## Common tasks

### Read character and word counts

```ts
import type { CharacterCountStorage } from '@quirekit/extensions'

const counter = editor.storage.characterCount as CharacterCountStorage
console.log({ characters: counter.characters(), words: counter.words() })
```

Core types generic `storage` values as `unknown`, so this explicitly names the installed extension's storage type. The default character counter uses JavaScript string length; the default word counter splits on spaces. Neither is a grapheme counter or a Chinese word tokenizer.

### Change when placeholders appear

```ts
const allEmptyNodes = Placeholder.configure({
  placeholder: 'Start writing',
  showOnlyCurrent: false,
  includeChildren: true,
})
```

Use `allEmptyNodes` in place of the original Placeholder entry when creating an Editor. Remove the entry from the initialization array to disable it. This package has no all-features preset or global enable switch.

### Customize history without installing it twice

```ts
import { UndoRedo } from '@quirekit/extensions'

const historyExtensions = [
  StarterKit.configure({ undoRedo: false }),
  DomViewExtension,
  UndoRedo.configure({ depth: 200, newGroupDelay: 500 }),
]

editor.commands.setHeading({ level: 2 })
console.log(editor.commands.undo())
```

`historyExtensions` configures a new Editor. The last two lines exercise undo in the current example, which still uses StarterKit's default history. StarterKit also includes BaseKeymap, Gapcursor, and TrailingNode by default; disable their preset entries before adding separate copies.

### Clean up when a component or page closes

```ts
editor.destroy()
```

Destroying the Editor releases extension plugins and listeners. Put this in the host's unmount callback, not immediately after page initialization.

## Related packages

| Package | Responsibility |
| --- | --- |
| [@quirekit/core](../../core/editor/README.md) | Editor, extension lifecycle, and command execution |
| [@quirekit/starter-kit](../../core/starter-kit/README.md) | Document structure preset that already includes some behaviors from this package |
| `@quirekit/dom-view` | Display and input implementation used here |
| [@quirekit/msfe-core](../../msfe/core/README.md) | Independent Markdown source editor that does not consume these extensions |

## Current limitations

- APIs in `0.x` alpha are not stable. Keep companion QuireKit packages on the same version.
- Extensions do not generate toolbars, format-painter buttons, block drag handles, or persistence interfaces.
- Decoration display depends on the view and CSS. The placeholder CSS here is specifically for the native DOM view.
- Default counting rules are simple. Configure `textCounter` / `wordCounter` for language-specific counting rather than treating the defaults as linguistic analysis.
- Installing this package alone does not form a valid document schema or automatically install every command into an instance.

## License

MIT. See [LICENSE.md](LICENSE.md). Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

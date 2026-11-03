# @quirekit/starter-kit

[中文](README.zh-CN.md)

A preset that installs common rich-text structures, text formatting, keyboard shortcuts, and undo history into `@quirekit/core`.

## When to use it

- Use it to start an editor with paragraphs, headings, lists, and basic text formatting.
- Configure or disable features individually without first assembling every extension package.
- This is not an editor instance, toolbar, or view. Do not install it into MSFE; the Markdown source editor uses [msfe-starter-kit](../../msfe/starter-kit/README.md).

## Installation

These commands also install Core and the native DOM view required by the example.

```bash
npm install @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

```bash
pnpm add @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

This package has no peer dependencies. Regular dependencies are installed automatically. Core and the DOM view are listed because the example imports them directly. Packages expose ESM exports.

## Minimal example

Put this in a browser TypeScript project's entry, such as `src/main.ts`, and start the page through your project's bundler.

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
  content: '<p>Hello QuireKit</p>',
})

console.log(editor.getJSON())
```

The page shows an editable paragraph and the console shows structured content. Subsequent snippets reuse these imports and `editor`.

## Core concepts and included extensions

- A **preset** is an extension that includes other extensions. Use `extensions: [StarterKit]`; do not spread it into the array.
- **Nodes and marks** describe document structures and text formatting. A schema cannot store content without the corresponding node definition.
- **Configuration keys** are listed below. Most accept an options object or `false`; `baseKeymap` accepts only a boolean.
- A **view** handles display and input. This package does not supply one; the example explicitly selects `dom`.

This is the default installation list, not a claim that every extension is individually exported from this package's root.

| Category | Installed extensions | Configuration keys |
| --- | --- | --- |
| Basic structure | Document, Paragraph, Text | `document`, `paragraph`, `text` |
| Blocks | Blockquote, HardBreak, Heading, HorizontalRule, CodeBlock | `blockquote`, `hardBreak`, `heading`, `horizontalRule`, `codeBlock` |
| Lists | BulletList, OrderedList, ListItem, ListKeymap | `bulletList`, `orderedList`, `listItem`, `listKeymap` |
| Text formatting | Bold, Code, Italic, Strike, Underline | `bold`, `code`, `italic`, `strike`, `underline` |
| Editing behavior | Gapcursor, TrailingNode, BaseKeymap, UndoRedo | `gapcursor`, `trailingNode`, `baseKeymap`, `undoRedo` |

Gapcursor enables cursor positions between some block nodes. TrailingNode appends an editable final paragraph when needed. BaseKeymap supplies basic editing keys, and UndoRedo supplies history.

## Common tasks

### Restrict heading levels and disable code blocks

```ts
const configuredKit = StarterKit.configure({
  heading: { levels: [1, 2, 3] },
  codeBlock: false,
})
```

Use `[configuredKit, DomViewExtension]` as the new Editor's `extensions` array. Configuration applies during initialization; this does not alter the existing `editor`.

### Replace one behavior extension

```ts
import { UndoRedo } from '@quirekit/starter-kit'

const historyExtensions = [
  StarterKit.configure({ undoRedo: false }),
  UndoRedo.configure({ depth: 200, newGroupDelay: 500 }),
  DomViewExtension,
]
```

Pass `historyExtensions` to a new Editor. Disable the preset's copy first to avoid installing the same feature twice. For options alone, `StarterKit.configure({ undoRedo: { depth: 200 } })` is enough.

### Run formatting commands, read content, and clean up

```ts
editor.chain().toggleBold().run()
editor.commands.setHeading({ level: 2 })
editor.commands.undo()
console.log(editor.getJSON())
```

Installed child extensions supply these commands. Do not call a feature's commands after disabling it. Dispose of the instance when leaving the page or component:

```ts
editor.destroy()
```

## Related packages

| Package | Responsibility |
| --- | --- |
| [@quirekit/core](../editor/README.md) | Creates the Editor, runs commands, and owns document state |
| `@quirekit/dom-view` | Native browser editing surface used by the example |
| [@quirekit/extensions](../../extensions/extensions/README.md) | Some behaviors included here, plus optional features such as placeholders and counting |
| [@quirekit/msfe-starter-kit](../../msfe/starter-kit/README.md) | Separate Markdown source preset, not interchangeable with this one |

## Current limitations

- `0.x` alpha is not stable. Keep companion QuireKit packages on the same version.
- Links, images, tables, placeholders, and character counting are not included by default. Install their extensions separately.
- Before disabling basic structures such as `document`, `paragraph`, or `text`, provide replacements that form a valid schema. List children also have structural dependencies; removing them arbitrarily can break lists.
- The preset does not supply persistence, a toolbar, pagination, or collaboration services, and does not promise lossless import of arbitrary HTML or unknown JSON.

## License

MIT. See [LICENSE.md](LICENSE.md). Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

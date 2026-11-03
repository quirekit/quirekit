# @quirekit/msfe-starter-kit

[中文](README.zh-CN.md)

A Markdown feature preset for MSFE, combining headings, bold, links, images, and common prose presentation.

## When to use it

- Use it to start with ready-made Markdown features, then disable or replace individual entries.
- It remains source-first: Markdown text is authoritative, and visual presentation does not become a second rich-text document.
- It is not a complete Markdown renderer or a WYSIWYG product UI. It supplies no toolbar and does not cover every dialect.
- It is only for MSFE, not the StarterKit used by `@quirekit/core`.

## Installation

```bash
npm install @quirekit/msfe-core @quirekit/msfe-starter-kit
```

```bash
pnpm add @quirekit/msfe-core @quirekit/msfe-starter-kit
```

This package has no peer dependencies. Included feature packages are regular dependencies and install automatically. Core is listed explicitly because the example imports it directly. Packages expose ESM exports.

## Minimal example

Put this in a browser TypeScript project's entry, such as `src/main.ts`, and run it through your project's bundler.

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'

const parent = document.createElement('div')
document.body.append(parent)

const editor = createMsfeEditor({
  parent,
  markdown: '# A note\n\n**Bold**, *emphasis*, and `code`.\n',
  mode: 'live',
  extensions: [StarterKit],
})

console.log(editor.getMarkdown())
```

The page shows editable content, while the console still outputs Markdown with its markers. The editor includes basic display styling; no separate theme CSS import is required. Subsequent snippets reuse these imports and `editor`.

## Core concepts and included extensions

- A **preset** is a definition that includes child extensions. Use `[StarterKit]` directly.
- **Source presentation** changes display only. `source` mode retains syntax markers; `live` presents supported syntax as formatting or components, but editing may still reveal markers.
- A **configuration value** is `false` or a complete extension definition, not that feature's bare options object. This differs from the rich-text StarterKit.
- **Commands** are installed by features. Disabling a feature means its commands cannot be assumed available at runtime, even if their methods remain visible in TypeScript.

| Configuration key | Default feature |
| --- | --- |
| `heading` | Headings and heading-section folding |
| `bold` | Bold |
| `link` | Links |
| `codeBlock` | Fenced code blocks |
| `image` | Image presentation |
| `emphasis` | Emphasis |
| `inlineCode` | Inline code |
| `strikethrough` | Strikethrough |
| `horizontalRule` | Thematic separators |
| `blockquote` | Quote bodies and prefixes |
| `listMarkers` | Native list prefixes |
| `taskItem` | Task checkboxes |
| `table` | GFM table presentation |
| `textLiterals` | Prose escapes, entities, and line breaks |
| `dataUrlFold` | Folds long base64 data URLs into size labels without changing source |

GFM is a set of Markdown conventions that adds syntax such as tables and task lists. Support for these entries does not imply complete GFM conformance.

## Common tasks

### Disable features

```ts
const configuredKit = StarterKit.configure({
  image: false,
  table: false,
})
```

Use `[configuredKit]` instead of `[StarterKit]` when creating an Editor. Disabling presentation does not delete image or table source from the document.

### Configure a child extension: disable heading folding

When importing a child package directly, install it explicitly rather than relying on transitive dependencies being hoisted:

```bash
npm install @quirekit/msfe-heading
```

The pnpm equivalent is `pnpm add @quirekit/msfe-heading`.

```ts
import { Heading } from '@quirekit/msfe-heading'

const noHeadingFolding = StarterKit.configure({
  heading: Heading.configure({ folding: false }),
})
```

Pass `[noHeadingFolding]` to a new Editor. Do not write `heading: { folding: false }`: the outer option expects an extension definition. Do not also install a second Heading separately.

### Use the array factory

```ts
import { starterKit } from '@quirekit/msfe-starter-kit'

const featureExtensions = starterKit({ image: false })
```

Pass `featureExtensions` directly as `extensions`, not `[featureExtensions]`. `StarterKit` is one preset; `starterKit()` returns an extension array. Pick one form rather than installing both.

### Run installed commands and clean up

```ts
const accepted = editor.chain().setHeading(2).toggleBold().run()
if (!accepted) console.warn(editor.lastCommandResult)
editor.undo()
console.log(editor.getMarkdown())
```

Commands return booleans. Core itself supplies `undo()` / `redo()`; history is not an extra feature of this preset. During page or component cleanup:

```ts
editor.destroy()
```

## Related packages

| Package | Responsibility |
| --- | --- |
| [@quirekit/msfe-core](../core/README.md) | Editor, text state, modes, history, and save reads |
| `@quirekit/msfe-heading`, `msfe-bold`, `msfe-link`, `msfe-code-block`, `msfe-image` | Individual features and their configuration |
| `@quirekit/msfe-prose` | Prose features from emphasis through dataUrlFold in the table |
| [@quirekit/msfe-vue](../vue/README.md) / [@quirekit/msfe-react](../react/README.md) | Framework integration using the same preset and authoritative Markdown |

## Current limitations

- `0.x` alpha is not stable. Keep companion QuireKit packages on the same version.
- HTML presentation, math, footnotes, diagrams, and other extra syntax are not included by default. Unknown or disabled content stays source text.
- The host configures language loaders for code-block highlighting; this preset does not bundle every programming language.
- Image uploads, private-resource authorization, and persistence belong to the host. The default image feature is not an upload service.
- List, task, and table presentation does not imply arbitrary complex interactions or arbitrary editable component bodies.
- Reassigning a configuration object after initialization does not hot-replace the installed extensions.

## License

MIT. See [LICENSE.md](LICENSE.md). Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

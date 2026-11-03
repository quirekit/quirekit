# @quirekit/msfe-vue

[中文](README.zh-CN.md)

Vue 3 integration for MSFE, managing editor mounting, cleanup, state subscriptions, and Vue component-view lifecycles.

## When to use it

- Use it to embed a Markdown editing surface in Vue and run commands from your own buttons or toolbar.
- MSFE is source-first: saved content is Markdown text, and live presentation does not create a second authoritative rich-text model.
- It is not a WYSIWYG component with a built-in toolbar, or a full-text `v-model` binding on every keystroke.
- Use [msfe-core](../core/README.md) for plain TypeScript integration or [msfe-react](../react/README.md) for React.

## Installation

```bash
npm install @quirekit/msfe-vue @quirekit/msfe-core @quirekit/msfe-starter-kit vue@^3.5.40
```

```bash
pnpm add @quirekit/msfe-vue @quirekit/msfe-core @quirekit/msfe-starter-kit vue@^3.5.40
```

The peer dependency is `vue: ^3.5.40`; check that range even in an existing Vue app. Core is a regular dependency, listed explicitly because the example imports its types. StarterKit supplies example features and is not a peer dependency. Packages expose ESM exports.

## Minimal example

In a browser project already configured for Vue single-file components and TypeScript, put this in `App.vue`. No additional UI library or theme CSS import is required.

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import type { MsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { MsfeEditorContent, type VueEditorOptions } from '@quirekit/msfe-vue'

const editor = shallowRef<MsfeEditor>()
const saved = shallowRef('')
const revision = shallowRef(0)
const options: VueEditorOptions = {
  documentId: 'note-1',
  markdown: '# Hello Vue\n\nEdit this **Markdown**.\n',
  mode: 'live',
  extensions: [StarterKit],
  onChange: event => { revision.value = event.revision },
  onError: error => console.error(error),
}

/** @param instance - Editor whose mount has completed. */
function ready(instance: MsfeEditor): void {
  editor.value = instance
}

/** Read the full text explicitly rather than copying Markdown on every input. */
function readMarkdown(): void {
  saved.value = editor.value?.getMarkdown() ?? ''
}
</script>

<template>
  <section>
    <button type="button" :disabled="!editor" @click="readMarkdown">Read Markdown</button>
    <span>Revision: {{ revision }}</span>
    <MsfeEditorContent :options="options" @ready="ready" />
    <pre>{{ saved }}</pre>
  </section>
</template>
```

Edit the document and click the button to display its current Markdown below. `MsfeEditorContent` creates the instance after mounting, passes it to the application through `ready`, and destroys it automatically on unmount.

## Core concepts

1. **Initial options**: `options` configures creation; it is not a continuously synchronized controlled value. Change content, mode, or theme through Editor methods.
2. **Editor reference**: `shallowRef` tracks instance availability without turning CodeMirror state into a deeply reactive Vue object. It is `undefined` before mounting.
3. **Source and presentation**: `getMarkdown()` reads authoritative source. `source`, `live`, and `locked` share a document; `locked` prevents editing, and `readOnly` independently controls editability.
4. **Component host**: custom Vue component views appear in the editor through Teleport while remaining in the application's Vue provider tree. CodeMirror still owns body input.
5. **Incremental subscriptions**: `onChange` reports content changes; `useMsfeState` observes a selected state slice, such as selection, rather than copying the full text on every input.

## Common tasks

Except for the final complete component, add these snippets to the main example's `<script setup>` and connect buttons to the relevant functions.

### Run a toolbar command

```ts
/** Toggle bold for the current selection or typing position. */
function toggleBold(): void {
  const instance = editor.value
  if (instance && !instance.commands.toggleBold()) {
    console.warn(instance.lastCommandResult)
  }
}
```

For example, bind a button with `@click="toggleBold"`. StarterKit supplies the command, which returns a boolean. Disabling a feature means its command cannot be assumed executable.

### Switch documents instead of repeatedly resetting initial values

```ts
/** Open another document, resetting the old selection and undo history. */
function openAnotherNote(): void {
  const result = editor.value?.replaceDocument('# Another note\n', 'note-2')
  if (result && !result.ok) console.warn(result.reason)
}
```

Do not feed every local change back through `replaceDocument()` in a watcher; that repeatedly resets history. To edit part of the current document, use Core's versioned `applyChanges()`, not the document-switching method.

### Change mode, read-only state, and theme

```ts
/** Show read-only source using the dark theme. */
function showReadOnlySource(): void {
  editor.value?.setMode('source')
  editor.value?.setReadOnly(true)
  editor.value?.setTheme('dark')
}
```

Use `setReadOnly(false)` to restore editing; if mode is `locked`, also switch to `source` or `live`. These changes do not recreate the editor.

### Observe selection instead of serializing the whole document

```ts
import { useMsfeState } from '@quirekit/msfe-vue'

const selectionStart = useMsfeState(editor, {
  select: state => state.selection.main.from,
})
```

Display `{{ selectionStart }}` in the template if needed. It is `undefined` before mounting; the subscription is cleaned up with the Vue scope. Positions are zero-based logical-source UTF-16 offsets.

### Own the mount layout

For custom outer layouts, **replace** the main example with this component rather than nesting another `MsfeEditorContent`:

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { useMsfeEditor, VueNodeViewHost } from '@quirekit/msfe-vue'

const parent = shallowRef<HTMLElement | null>(null)
const { editor, host } = useMsfeEditor(parent, () => ({
  markdown: '# Custom mount\n',
  mode: 'live',
  extensions: [StarterKit],
}))
</script>

<template>
  <div>
    <button type="button" :disabled="!editor" @click="editor?.undo()">Undo</button>
    <div ref="parent" />
    <VueNodeViewHost :host="host" />
  </div>
</template>
```

`useMsfeEditor` owns creation and destruction. `VueNodeViewHost` owns component views; providing your own mount div does not replace it. Do not manually create a second instance or destroy the instance borrowed from this composable.

## Related packages

| Package | Responsibility |
| --- | --- |
| [@quirekit/msfe-core](../core/README.md) | Markdown, commands, history, document identity, and revisions |
| [@quirekit/msfe-starter-kit](../starter-kit/README.md) | Default syntax features that can be disabled or replaced |
| `@quirekit/msfe-vue` | `MsfeEditorContent`, `useMsfeEditor`, `useMsfeState`, and Vue component-view integration |
| [@quirekit/msfe-react](../react/README.md) | React integration; not a dependency of this package |

## Current limitations

- `0.x` alpha is not stable. The Vue peer range is `^3.5.40`, not every Vue 3 version.
- Later changes to `options` do not recreate or reset the instance. There is no full-text `v-model` protocol.
- This is a browser editing component, not complete static Markdown reading content rendered on the server.
- Custom component views are not arbitrary editable rich-text containers. Vue must not take over CodeMirror's body DOM.
- Your application still owns toolbars, file saving, uploads, and resource permissions. StarterKit / Core define the default syntax coverage and content limits.

## License

MIT. See [LICENSE.md](LICENSE.md). Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

# @quirekit/devtools

English | [简体中文](./README.zh-CN.md)

Inspects editor state, interaction records and rendering information to help diagnose editing problems.

## Installation

```bash
npm install @quirekit/devtools
```

## Usage

This installs recording in a Core editor without mounting a view. Also install `@quirekit/core` and `@quirekit/starter-kit`. In a browser, call `mountPanel(element)` to show the diagnostic panel.

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { createQuireDevtools } from '@quirekit/devtools'

const tools = createQuireDevtools()
const editor = new Editor({ extensions: [StarterKit, tools.extension()] })
console.log(tools.getSnapshot())
editor.destroy()
tools.destroy()
```

## Things to know

- Enable it where diagnostics are needed. Check exported diagnostics for user document content before sharing them.

## Related documentation

- [Editor core](../../core/editor/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/ui

English | [简体中文](./README.zh-CN.md)

Shared QuireKit interface components and theme tools, including buttons, inputs, dialogs, menus and tables. They can be used independently in Vue applications.

## Installation

```bash
npm install @quirekit/ui
```

The consuming project also needs: `@ark-ui/vue` (^5.39.1).

## Usage

Import Vue components from `/vue` and theme/browser utilities from the root entry. Also install `@quirekit/unocss-preset` for the stylesheet below.

```vue
<script setup lang="ts">
import { QuireButton } from '@quirekit/ui/vue'
import '@quirekit/unocss-preset/quirekit.css'
</script>

<template>
  <QuireButton>Save</QuireButton>
</template>
```

## Things to know

- Component guides and examples are in the repository’s `apps/design` documentation site.
- Configure colors, typography and spacing through a shared theme so components remain consistent.

## Related documentation

- [Component styles](../unocss-preset/README.md)
- [Component documentation site](../../apps/design/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

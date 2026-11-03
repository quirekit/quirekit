# @quirekit/pm-schema-list

English | [简体中文](./README.zh-CN.md)

Provides list node definitions and commands for splitting and changing list depth.

This package maintains the corresponding ProseMirror functionality under the `@quirekit` scope for QuireKit and its extensions.

## Installation

```bash
npm install @quirekit/pm-schema-list
```

## Usage

Use it with a custom PM schema. Core applications can install extension-list instead.

Common entry points: addListNodes, wrapInList, splitListItem, sinkListItem and liftListItem.

## Things to know

- Use one @quirekit/pm-* family per editor. Mixing instances from official prosemirror-* packages can give nodes, selections or plugins different module identities.
- For a complete editor setup, start with Core and StarterKit rather than assembling every low-level package.

## Related documentation

- [Core editor](../../core/editor/README.md)
- [Native DOM view](../../dom-view/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

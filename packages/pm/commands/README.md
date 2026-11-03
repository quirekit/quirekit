# @quirekit/pm-commands

English | [简体中文](./README.zh-CN.md)

Provides basic editing commands for splitting, joining, deletion and selection.

This package maintains the corresponding ProseMirror functionality under the `@quirekit` scope for QuireKit and its extensions.

## Installation

```bash
npm install @quirekit/pm-commands
```

## Usage

Commands receive state and may dispatch a transaction. Use StarterKit’s default keyboard behavior for ordinary editor setup.

Common entry points: baseKeymap, splitBlock and joinBackward.

## Things to know

- Use one @quirekit/pm-* family per editor. Mixing instances from official prosemirror-* packages can give nodes, selections or plugins different module identities.
- For a complete editor setup, start with Core and StarterKit rather than assembling every low-level package.

## Related documentation

- [Core editor](../../core/editor/README.md)
- [Native DOM view](../../dom-view/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

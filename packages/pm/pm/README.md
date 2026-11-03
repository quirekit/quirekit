# @quirekit/pm

English | [简体中文](./README.zh-CN.md)

Re-exports the ProseMirror data, state, command and plugin tools used by QuireKit.

This package maintains the corresponding ProseMirror functionality under the `@quirekit` scope for QuireKit and its extensions.

## Installation

```bash
npm install @quirekit/pm
```

## Usage

Useful for extension authors who need several PM modules. It does not include native EditorView; use pm-view or dom-view for that.

Common entry points: Schema, EditorState, Plugin, DecorationSet and other utilities.

## Things to know

- Use one @quirekit/pm-* family per editor. Mixing instances from official prosemirror-* packages can give nodes, selections or plugins different module identities.
- For a complete editor setup, start with Core and StarterKit rather than assembling every low-level package.

## Related documentation

- [Core editor](../../core/editor/README.md)
- [Native DOM view](../../dom-view/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

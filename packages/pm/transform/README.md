# @quirekit/pm-transform

English | [简体中文](./README.zh-CN.md)

Provides document insertion, deletion, replacement and position mapping.

This package maintains the corresponding ProseMirror functionality under the `@quirekit` scope for QuireKit and its extensions.

## Installation

```bash
npm install @quirekit/pm-transform
```

## Usage

Use it for low-level document operations. Most applications should call Core commands.

Common entry points: Transform, Step and Mapping.

## Things to know

- Use one @quirekit/pm-* family per editor. Mixing instances from official prosemirror-* packages can give nodes, selections or plugins different module identities.
- For a complete editor setup, start with Core and StarterKit rather than assembling every low-level package.

## Related documentation

- [Core editor](../../core/editor/README.md)
- [Native DOM view](../../dom-view/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

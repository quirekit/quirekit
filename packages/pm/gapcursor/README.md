# @quirekit/pm-gapcursor

English | [简体中文](./README.zh-CN.md)

Allows a cursor at block boundaries where a normal text cursor cannot go, such as between non-editable blocks.

This package maintains the corresponding ProseMirror functionality under the `@quirekit` scope for QuireKit and its extensions.

## Installation

```bash
npm install @quirekit/pm-gapcursor
```

## Usage

gapCursor() supplies selection and keyboard behavior. The mounted view draws the cursor.

Common entry points: GapCursor and gapCursor.

## Things to know

- Use one @quirekit/pm-* family per editor. Mixing instances from official prosemirror-* packages can give nodes, selections or plugins different module identities.
- For a complete editor setup, start with Core and StarterKit rather than assembling every low-level package.

## Related documentation

- [Core editor](../../core/editor/README.md)
- [Native DOM view](../../dom-view/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

# @quirekit/view-html

English | [简体中文](./README.zh-CN.md)

QuireKit’s continuous-flow HTML view. The browser lays out the document while QuireKit owns input, the caret and selections. It suits unpaginated surfaces such as comments, chat and block editors.

## Installation

```bash
npm install @quirekit/view-html
```

## Usage

Add `htmlViewExtension({ runtime })` to Core’s extensions and mount with `mode: "html"`. For a ready-made block editor, use the [Block product](../block-editor/README.md).

## Things to know

- This is a retained HTML view, distinct from the native contenteditable in `@quirekit/dom-view`; their input and geometry handling differ.
- It has no paginated display; paginated documents use the Canvas or SVG views of [`@quirekit/view`](../view/README.md).

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

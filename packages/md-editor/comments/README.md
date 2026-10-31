# @quirekit/md-editor-comments

English | [简体中文](./README.zh-CN.md)

Comments for Md Editor: comments on selected text, replies, resolving, @ mentions, comments on the whole document, the side rail on wide screens, the comment list, and CriticMarkup file import and export. Comments never enter the Markdown; the application stores them.

## Installation

```bash
npm install @quirekit/md-editor-comments@alpha
```

## Usage

```ts
import { mdComments } from "@quirekit/md-editor-comments";
import "@quirekit/md-editor-comments/styles.css";

const comments = mdComments({ user: { id: "lin", name: "Lin" }, onChange: change => save(change.snapshot()) });
```

Pass `comments` to `MdEditor`'s `comments`. Read or import comment data with `getComments(editor)` from `@quirekit/msfe-comments`.

## Notes

- Without `comments`, Md Editor shows no comment controls.
- `criticMarkup` is off by default; `documentComments: "end"` adds a document comment section after the text.

## Related

- [Md Editor](../editor/README.md)
- [Comment data and anchors](../../msfe/comments/README.md)

## License

[Commercial license](./LICENSE.md): free for development and evaluation; production use requires a license key. Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

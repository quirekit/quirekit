# @quirekit/msfe-comments

English | [简体中文](./README.zh-CN.md)

Adds comments, replies, resolution status and anchored text quotes to Markdown documents.

## Installation

```bash
npm install @quirekit/msfe-comments@alpha
```

## Usage

Configure the current user with Comments.configure({ user, ... }) and add it to extensions. Get the controller with getComments(editor). Your application supplies the sidebar, notifications and storage; use onChange to obtain snapshots for persistence.

## Things to know

- Comments are saved separately from Markdown. Reopening a document must restore both text and its comments.

## Related documentation

- [MSFE guide](../core/README.md)

## License

[Commercial license](./LICENSE.md): free for development and evaluation; production use requires a license key. Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

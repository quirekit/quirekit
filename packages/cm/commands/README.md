# @quirekit/cm-commands

English | [简体中文](./README.zh-CN.md)

Provides CodeMirror cursor movement, editing commands, undo history and default shortcuts.

## Installation

```bash
npm install @quirekit/cm-commands
```

## Usage

Add history() and keymap.of([...defaultKeymap, ...historyKeymap]) to the editor’s extensions. Import keymap from cm-view; installing this package alone does not bind shortcuts.

## Things to know

- Maintained from `@codemirror/commands` 6.11.1; UPSTREAM.json records its origin and local changes.
- Use @quirekit/cm-* consistently within an editor rather than mixing official @codemirror/* instances.

## Related documentation

- [Markdown editor using these packages](../../msfe/core/README.md)

## License

[MIT](./LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

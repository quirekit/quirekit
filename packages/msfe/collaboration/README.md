# @quirekit/msfe-collaboration

English | [简体中文](./README.zh-CN.md)

Lets users edit the same Markdown document with synchronization, collaborative undo and session recovery.

## Installation

```bash
npm install @quirekit/msfe-collaboration
```

## Usage

Create a session with createCollaborationSession, then install the Collaboration extension in MSFE. The application supplies document identity, service transport and persistence. The server must implement the session protocol, not just expose an arbitrary WebSocket.

## Things to know

- Collaboration and durable server storage are separate. Show connection, synchronization and save status rather than equating synchronization with persistence.

## Related documentation

- [MSFE guide](../core/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

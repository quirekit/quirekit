# @quirekit/msfe-collaboration-hocuspocus

English | [简体中文](./README.zh-CN.md)

Connects MSFE collaboration sessions to a Hocuspocus service.

## Installation

```bash
npm install @quirekit/msfe-collaboration-hocuspocus
```

## Usage

Create a provider with hocuspocusProvider({ url, sessionEndpoint, token }) and give it to msfe-collaboration. url is the WebSocket endpoint; sessionEndpoint is your HTTP session endpoint returning document identity, room and recovery information.

## Things to know

- A default Hocuspocus server alone is insufficient; the application must implement session admission and persistence.

## Related documentation

- [MSFE guide](../core/README.md)
- [Collaboration sessions](../collaboration/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

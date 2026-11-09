# @quirekit/ai-contract

English | [简体中文](./README.zh-CN.md)

The type contract extensions use to describe themselves to AI. Extensions declare readable formats, content blocks, structure roles and source blocks through `addAiCapabilities()`, and third-party agents can integrate with QuireKit documents against the same contract.

## Installation

```bash
npm install @quirekit/ai-contract
```

## Usage

Import it with `import type` only. Once imported, `addAiCapabilities` appears on the `Extension`, `Node` and `Mark` configuration types:

```ts
import type { QuireAiCapability } from "@quirekit/ai-contract";
```

## Notes

- The package contains types only; reading documents, running edits and validation are done by `@quirekit/ai-runtime`.
- A format may declare `satisfied` for a whole-range idempotence rule owned by the same declaration as `apply`. Without it, the runtime compares `read` on every paragraph or character run. The callback only reads the current document and mapped range; it does not run commands.

## Related

- [AI runtime](../runtime/README.md)

## License

[MIT](./LICENSE.md)

import { describe, expect, it } from "vitest";
import { createFakeSourceDocument } from "./fixture.test-support";
import { createQuireAiSourceDocumentSdk } from "./sdk";

describe("source figures", () => {
  const facts = () => [{
    kind: "source-block" as const, names: ["FencedCode"],
    authoring: [{ fence: "mermaid", description: "Sequence, state and pie charts." }],
    check: { languages: ["mermaid"], run: async (block: { text: string }) => block.text.includes("oops") ? "Parse error on line 2" : undefined }
  }];

  it("lists figures, checks written figures and refuses only the broken one", async () => {
    const document = createFakeSourceDocument("段落一。", { capabilities: facts });
    const sdk = createQuireAiSourceDocumentSdk(document, { documentId: "doc" });
    expect(sdk.tools().find(tool => tool.name === "document_edit")?.description).toContain("- ```mermaid: Sequence, state and pie charts.");
    expect(sdk.instructions()).toContain("Illustrated writing");
    const request = sdk.captureRequest();
    const result = await sdk.invoke({ toolName: "document_edit", operationId: "op", requestId: request.id, input: { operations: [
      { op: "insert", at: "end", blocks: ["```mermaid\npie\n  \"A\": 1\n```"] },
      { op: "insert", at: "end", blocks: ["```mermaid\noops\n```"] }
    ] } });
    expect(result.summary).toContain("Applied 1 of 2 operations.");
    expect(result.summary).toContain("Operation 2 (insert): the mermaid figure does not render: Parse error on line 2");
    expect(document.text()).toContain("pie");
    expect(document.text()).not.toContain("oops");
  });

  it("fails an operation whose preparation fails and applies the rest", async () => {
    const document = createFakeSourceDocument("段落一。", {
      commands: { drawThing: { descriptor: { description: "Draws.", target: "document", prepare: async () => { throw new Error("renderer unavailable"); } }, run: () => [] } }
    });
    const sdk = createQuireAiSourceDocumentSdk(document, { documentId: "doc" });
    expect(sdk.instructions()).not.toContain("Illustrated writing");
    const request = sdk.captureRequest();
    const result = await sdk.invoke({ toolName: "document_edit", operationId: "op", requestId: request.id, input: { operations: [
      { op: "drawThing" }, { op: "append", block: "b1", text: "继续" }
    ] } });
    expect(result.summary).toContain("Operation 1 (drawThing): renderer unavailable.");
    expect(document.text()).toBe("段落一。继续");
  });
});

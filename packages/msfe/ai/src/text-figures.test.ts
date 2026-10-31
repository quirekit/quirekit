// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createMsfeEditor, type MsfeEditor } from "@quirekit/msfe-core";
import { StarterKit } from "@quirekit/msfe-starter-kit";
import { Mermaid, TextDiagrams, textFigureRenderPort } from "@quirekit/msfe-markdown-extras";
import { MsfeAi } from "./extension";
import { createMsfeDocumentSdk } from "./sdk";

const editors: MsfeEditor[] = [];
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

/** Renderer stand-in: source containing "oops" fails like a grammar error. */
const ports = { [textFigureRenderPort]: async (_language: string, source: string) => { if (source.includes("oops")) throw new Error("Parse error on line 2: oops"); } };

describe("AI text figures in MSFE", () => {
  it("checks fenced figures, inserts and replaces them through commands", async () => {
    const parent = document.body.appendChild(document.createElement("div"));
    const editor = createMsfeEditor({ parent, markdown: "登录过程如下。", extensions: [StarterKit, Mermaid, TextDiagrams, MsfeAi] });
    editors.push(editor);
    const sdk = createMsfeDocumentSdk(editor, { documentId: "doc", ports });
    const edit = sdk.tools().find(tool => tool.name === "document_edit")!;
    expect(edit.description).toContain("- ```mermaid: Mermaid: sequence diagrams");
    expect(edit.description).toContain("insertTextDiagram");
    const request = sdk.captureRequest();
    let call = 0;
    const run = async (operations: unknown[]) => (await sdk.invoke({ toolName: "document_edit", operationId: `op-${++call}`, requestId: request.id, input: { operations } })).summary;
    const raw = await run([{ op: "insert", at: "end", blocks: ["```mermaid\nsequenceDiagram\n  oops\n```"] }]);
    expect(raw).toContain("the mermaid figure does not render: Parse error on line 2: oops");
    expect(editor.getMarkdown()).toBe("登录过程如下。");
    expect(await run([{ op: "insertTextDiagram", block: "b1", params: { language: "plantuml", source: "@startuml\nA -> B\n@enduml" } }])).toContain("Applied 1 operation(s).");
    expect(editor.getMarkdown()).toBe("登录过程如下。\n\n```plantuml\n@startuml\nA -> B\n@enduml\n```");
    const view = (await sdk.invoke({ toolName: "document_read", operationId: "read", requestId: request.id, input: {} })).summary;
    const id = /\[(b\d+)\] ```plantuml/u.exec(view)![1]!;
    expect(await run([{ op: "updateTextDiagram", block: id, params: { language: "mermaid", source: "oops" } }])).toContain("the mermaid source does not render");
    expect(await run([{ op: "updateTextDiagram", block: id, params: { language: "mermaid", source: "pie\n  \"A\": 1" } }])).toContain("Applied 1 operation(s).");
    expect(editor.getMarkdown()).toContain("```mermaid\npie");
    sdk.destroy();
  });
});

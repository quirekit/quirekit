import { Editor, Node } from "@quirekit/core";
import { Type } from "typebox";
import type { QuireAiToolHost } from "../tool-host";
import type { QuireDocumentTool } from "../document-tools";
import { QuireDocumentSdkError } from "./error";

/** @returns Real headless editor with the smallest document schema. */
export function createDocumentFixture(): Editor {
  return new Editor({ extensions: [
    Node.create({ name: "doc", topNode: true, content: "block+" }),
    Node.create({ name: "paragraph", group: "block", content: "inline*" }),
    Node.create({ name: "text", group: "inline" })
  ], content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Alpha Beta" }] }] } });
}

const parameters = Type.Object({ text: Type.String() }, { additionalProperties: false });

/** @param host - Guarded write authority. @returns Test feature using only typed editor commands. */
export function createReplaceTool(host: QuireAiToolHost): QuireDocumentTool<typeof parameters> {
  return { name: "replace", label: "Replace", description: "Replace original selection", effect: "write",
    parameters,
    async execute(input, context) {
      if (context.selection === null) throw new QuireDocumentSdkError("stale-target", "The original request selection was deleted.");
      const result = await host.executeWrite({ toolCallId: context.callId, capabilityId: "test.replace",
        target: { kind: "selection", id: "captured" }, signal: context.signal, supportedModes: ["direct"],
        canApply: () => true, apply: editor => editor.commands.insertContentAt(context.selection!, { type: "text", text: input.text }) });
      return { value: result, summary: result.applied ? "Replaced" : "Unchanged" };
    } };
}

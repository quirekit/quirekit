// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createMsfeEditor, type MsfeEditor } from "@quirekit/msfe-core";
import { StarterKit } from "@quirekit/msfe-starter-kit";
import { MsfeAi } from "./extension";
import { createMsfeDocumentSdk } from "./sdk";

const editors: MsfeEditor[] = [];
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

/** Picture port stand-in storing every picture at a host address. */
const pictures = {
  list: () => [{ id: "icon/mail", category: "图标", description: "信封", aspect: 1 }],
  palettes: () => ["blue", "teal"],
  prepare: async ({ asset, palette }: { asset: string; palette?: string }) => ({ source: `https://cdn.example.com/${asset}-${palette ?? "blue"}.png`, intrinsicSize: { width: 3, height: 3 }, name: "x.png" })
};

describe("AI pictures in MSFE", () => {
  it("inserts built-in pictures through the host store and pictures the user gave", async () => {
    const parent = document.body.appendChild(document.createElement("div"));
    const editor = createMsfeEditor({ parent, markdown: "联系我们。", extensions: [StarterKit, MsfeAi] });
    editors.push(editor);
    const sdk = createMsfeDocumentSdk(editor, { documentId: "doc", ports: { pictures } });
    const request = sdk.captureRequest();
    let call = 0;
    const invoke = async (toolName: string, input: unknown) => (await sdk.invoke({ toolName, operationId: `op-${++call}`, requestId: request.id, input })).summary;
    expect(await invoke("document_help", { names: ["pictures"] })).toContain("- icon/mail (width:height 1): 信封");
    expect(await invoke("document_edit", { operations: [
      { op: "insertPicture", block: "b1", params: { asset: "icon/mail", palette: "teal", alt: "邮件图标", caption: "图 1 联系方式" } },
      { op: "insertPicture", block: "b1", params: { url: "https://example.com/a b.png", alt: "示意[图]" } },
      { op: "insertPicture", block: "b1", params: { alt: "空" } }
    ] })).toContain("Applied 2 of 3 operations.");
    expect(editor.getMarkdown()).toBe("联系我们。\n\n![邮件图标](https://cdn.example.com/icon/mail-teal.png)\n\n图 1 联系方式\n\n![示意\\[图\\]](<https://example.com/a b.png>)");
    sdk.destroy();
  });
});

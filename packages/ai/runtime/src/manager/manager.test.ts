import { defineCommand, Editor, Mark, Node, type CommandProps, type QuireAnyExtension } from "@quirekit/core";
import type { Transaction } from "@quirekit/pm";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { getQuireAi } from "./manager";
import { compileQuireAiRegistry } from "./registry";
import { describeQuireAiBlockReferences } from "./view/references";
import { renderQuireAiDocumentView } from "./view/render";

const text = Node.create({ name: "text", group: "inline" });
const bold = Mark.create({
  name: "bold",
  addAiCapabilities: () => [{ kind: "format", name: "bold", level: "character", description: "Bold.",
    read: target => target.level === "character" && target.marks.some(mark => mark.type.name === "bold") ? true : undefined }]
});
const color = Mark.create({
  name: "color", addAttributes: () => ({ value: { default: null } }),
  addAiCapabilities: () => [{ kind: "format", name: "color", level: "character", description: "Text color.",
    read: target => target.level === "character" ? target.marks.find(mark => mark.type.name === "color")?.attrs.value : undefined }]
});
const paragraph = Node.create({
  name: "paragraph", group: "block", content: "inline*", addAttributes: () => ({ align: { default: null } }),
  addAiCapabilities: () => [{ kind: "format", name: "align", level: "paragraph", description: "Alignment.",
    read: target => target.level === "paragraph" ? target.node.attrs.align ?? undefined : undefined }]
});
const cell = Node.create({ name: "cell", content: "paragraph+" });
const row = Node.create({ name: "row", content: "cell+" });
const table = Node.create({
  name: "table", group: "block", content: "row+", addAttributes: () => ({ caption: { default: null } }),
  addCommands: () => ({
    caption_table: defineCommand({
      description: "Sets the table caption.", target: "block", nodes: ["table"],
      params: { type: "object", properties: { caption: { type: "string" } }, required: ["caption"], additionalProperties: false },
      adapt: (params, { pos }) => pos === null ? null : { pos, caption: (params as { caption: string }).caption },
      run: (options: { pos: number; caption: string }) => ({ tr }: CommandProps) => { tr.setNodeMarkup(options.pos, undefined, { caption: options.caption }); return true; }
    })
  }),
  addAiCapabilities: () => [{ kind: "block", node: "table",
    label: node => `表格 ${node.childCount}×${node.firstChild?.childCount ?? 0}`,
    children: node => {
      const cells: { node: import("@quirekit/pm").Node; offset: number; caption: string; owners: readonly import("@quirekit/pm").Node[] }[] = [];
      node.forEach((r, rowOffset, rowIndex) => r.forEach((c, cellOffset, cellIndex) => {
        cells.push({ node: c, offset: rowOffset + 1 + cellOffset, caption: `(${rowIndex + 1},${cellIndex + 1})`, owners: [r] });
      }));
      return cells;
    } }]
});
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const story = Node.create({
  name: "story", content: "paragraph+", addAttributes: () => ({ kind: { default: "header" } }),
  addAiCapabilities: () => [{ kind: "structure", node: "story", role: "story", label: node => `页眉（${String(node.attrs.kind)}）` }]
});
const store = Node.create({ name: "store", content: "story*", addAiCapabilities: () => [{ kind: "structure", node: "store", role: "store" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body store" });

const p = (value: string, attrs: Record<string, unknown> = {}) =>
  ({ type: "paragraph", attrs, content: [{ type: "text", text: value }] });

/** @returns Editor with body, table, header story and formatted text. */
function createStructuredEditor(): Editor {
  return new Editor({ extensions: [doc, body, store, story, paragraph, table, row, cell, text, bold, color], content: {
    type: "doc", content: [
      { type: "body", content: [
        p("年度总结", { align: "center" }),
        { type: "paragraph", content: [
          { type: "text", text: "本季度的" },
          { type: "text", text: "核心指标", marks: [{ type: "bold" }] },
          { type: "text", text: "全部达成，" },
          { type: "text", text: "风险提示", marks: [{ type: "color", attrs: { value: "#FF0000" } }] }
        ] },
        { type: "table", content: [{ type: "row", content: [
          { type: "cell", content: [p("姓名")] }, { type: "cell", content: [p("部门")] }
        ] }] }
      ] },
      { type: "store", content: [{ type: "story", content: [p("公司名称")] }] }
    ]
  } });
}

describe("AI manager document view", () => {
  it("renders sections, formats, tables and stories", () => {
    const editor = createStructuredEditor();
    const manager = getQuireAi(editor);
    const view = renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { limit: 200, stories: true });
    expect(view.text).toBe([
      "## 正文",
      "[b1] {align:\"center\"} 年度总结",
      "[b2] 本季度的**核心指标**全部达成，[风险提示]{color:\"#FF0000\"}",
      "[b3] 表格 1×2",
      "  [b4] (1,1) 姓名",
      "  [b5] (1,2) 部门",
      "## 页眉（header）",
      "[b6] 公司名称"
    ].join("\n"));
    expect(view.total).toBe(6);
    editor.destroy();
  });

  it("adds the notes of a row to its first cell's caption and a cell's notes to its own", () => {
    const marks = Node.create({
      name: "marks",
      addAiCapabilities: () => [
        { kind: "note", node: "row", note: (_node, container) => `第 1 行属于${container.childCount}行表格` },
        { kind: "note", node: "cell", note: node => node.textContent === "部门" ? "已锁定" : undefined }
      ]
    });
    const editor = new Editor({ extensions: [doc, body, store, story, paragraph, table, row, cell, text, marks], content: {
      type: "doc", content: [
        { type: "body", content: [{ type: "table", content: [{ type: "row", content: [{ type: "cell", content: [p("姓名")] }, { type: "cell", content: [p("部门")] }] }] }] },
        { type: "store", content: [] }
      ]
    } });
    const manager = getQuireAi(editor);
    const view = renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { limit: 200, stories: false });
    expect(view.text).toBe(["## 正文", "[b1] 表格 1×2", "  [b2] (1,1) 第 1 行属于1行表格 姓名", "  [b3] (1,2) 已锁定 部门"].join("\n"));
    editor.destroy();
  });

  it("leaves out stories a label hides and relabels nodes a block label owns", () => {
    const watermark = Node.create({
      name: "watermark",
      addAiCapabilities: () => [
        { kind: "story-label", node: "story", label: node => node.attrs.kind === "textBox" ? null : undefined },
        { kind: "block-label", node: "table", label: node => node.childCount === 1 ? "单行表格" : undefined }
      ]
    });
    const editor = new Editor({ extensions: [doc, body, store, story, paragraph, table, row, cell, text, watermark], content: {
      type: "doc", content: [
        { type: "body", content: [{ type: "table", content: [{ type: "row", content: [{ type: "cell", content: [p("甲")] }] }] }] },
        { type: "store", content: [
          { type: "story", attrs: { kind: "textBox" }, content: [p("机密")] },
          { type: "story", content: [p("公司名称")] }
        ] }
      ]
    } });
    const manager = getQuireAi(editor);
    const view = renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { limit: 200, stories: true });
    expect(view.text).toBe(["## 正文", "[b1] 单行表格", "  [b2] (1,1) 甲", "## 页眉（header）", "[b3] 公司名称"].join("\n"));
    editor.destroy();
  });

  it("names blocks in replies by paragraph number or quote instead of internal ids", () => {
    const editor = createStructuredEditor();
    const manager = getQuireAi(editor);
    renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { limit: 200, stories: true });
    const present = (text: string, language: "zh" | "en" = "zh") =>
      describeQuireAiBlockReferences(text, editor.state.doc, manager.registry, manager.identity, language);
    expect(present("[b1] 是标题，b2 写了指标。")).toBe("第 1 段 是标题，第 2 段 写了指标。");
    expect(present("请看 b1-b3 和 b2 到 b5。")).toBe("请看 第 1 至 3 段 和 第 2 段至“部门”。");
    expect(present("页眉 b6 写着公司名。")).toBe("页眉 “公司名称” 写着公司名。");
    expect(present("Vitamin b99 stays, see b2.", "en")).toBe("Vitamin b99 stays, see paragraph 2.");
    const heading = editor.state.doc.firstChild!.firstChild!;
    editor.commands.command(({ tr }: { tr: Transaction }) => { tr.delete(1, 1 + heading.nodeSize); return true; });
    expect(present("已删除 b1。")).toBe("已删除 该段。");
    editor.destroy();
  });

  it("keeps ids of surviving blocks across edits and gives new blocks new ids", () => {
    const editor = createStructuredEditor();
    const manager = getQuireAi(editor);
    const read = () => renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { limit: 200, stories: false }).text;
    read();
    editor.commands.insertContentAt(1, p("新标题"));
    editor.commands.insertContentAt(editor.state.doc.child(0).nodeSize - 1, p("结尾"));
    const lines = read().split("\n");
    expect(lines[1]).toBe("[b7] 新标题");
    expect(lines[2]).toBe("[b1] {align:\"center\"} 年度总结");
    expect(lines.at(-1)).toBe("[b8] 结尾");
    expect(manager.identity.resolve("b2")).toBe(positionOfChild(editor, 2));
    editor.destroy();
  });

  it("drops the id of a deleted block", () => {
    const editor = createStructuredEditor();
    const manager = getQuireAi(editor);
    renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { limit: 200, stories: false });
    const first = editor.state.doc.child(0).child(0);
    editor.commands.deleteRange({ from: 1, to: 1 + first.nodeSize });
    expect(manager.identity.resolve("b1")).toBeNull();
    editor.destroy();
  });

  it("pages by block id and bounds each read", () => {
    const editor = createStructuredEditor();
    const manager = getQuireAi(editor);
    const first = renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { limit: 2, stories: true });
    expect(first.next).toBe("b3");
    const second = renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { from: "b3", limit: 2, stories: true });
    expect(second.text.split("\n")[0]).toBe("## 正文");
    expect(second.text).toContain("[b3] 表格 1×2");
    expect(() => renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { from: "b99", limit: 2, stories: true }))
      .toThrow(/read the document again/u);
    editor.destroy();
  });

  it("finds text anywhere and replaces every occurrence, keeping its formats", async () => {
    const editor = createStructuredEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const request = sdk.captureRequest();
    const invoke = (operationId: string, toolName: string, input: Record<string, unknown>) => sdk.invoke({ requestId: request.id, operationId, toolName, input });
    const texts = () => { const out: string[] = []; editor.state.doc.descendants(node => { if (node.isTextblock) out.push(node.textContent); return true; }); return out; };

    expect((await invoke("find", "document_read", { find: "名" })).summary).toBe([
      "## 正文", "  [b4] (1,1) 姓名", "## 页眉（header）", "[b6] 公司名称",
      "(2 of 2 blocks containing \"名\", 2 occurrence(s) in all)"
    ].join("\n"));
    const all = await invoke("all", "document_edit", { operations: [{ op: "replace_all", find: "名", replace: "号" }] });
    expect(all.summary).toContain("Applied 1 operation(s).\nOperation 1 replaced 2 occurrences.");
    expect(texts()).toEqual(["年度总结", "本季度的核心指标全部达成，风险提示", "姓号", "部门", "公司号称"]);
    await invoke("scoped", "document_edit", { operations: [{ op: "replace_all", find: "号", replace: "名", blocks: ["b3"] }] });
    expect(texts().slice(2)).toEqual(["姓名", "部门", "公司号称"]);
    await invoke("bold", "document_edit", { operations: [{ op: "replace_all", find: "核心", replace: "关键" }] });
    const bolded = editor.state.doc.child(0).child(1).child(1);
    expect([bolded.text, bolded.marks.map(mark => mark.type.name)]).toEqual(["关键指标", ["bold"]]);
    await expect(invoke("missing", "document_edit", { operations: [{ op: "replace_all", find: "不存在", replace: "x" }] }))
      .resolves.toMatchObject({ summary: expect.stringMatching(/Operation 1 \(replace_all\): text "不存在" does not occur in the document/u) });
    sdk.destroy();
    editor.destroy();
  });

  it("reads a document without facts as one body of text blocks", () => {
    const editor = new Editor({ extensions: [
      Node.create({ name: "doc", topNode: true, content: "block+" }),
      Node.create({ name: "paragraph", group: "block", content: "inline*" }), text
    ], content: { type: "doc", content: [p("Alpha"), p("Beta")] } });
    const manager = getQuireAi(editor);
    expect(renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { limit: 10, stories: true }).text)
      .toBe("## 正文\n[b1] Alpha\n[b2] Beta");
    expect(manager.createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: false, code: "permission-denied" }) }).tools()
      .map(tool => tool.name)).toEqual(["document_read", "document_edit", "document_help"]);
    editor.destroy();
  });

  it("captures document and selection context with each request", () => {
    const editor = createStructuredEditor();
    editor.commands.setTextSelection({ from: 12, to: 16 });
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const request = sdk.captureRequest();
    editor.commands.setTextSelection(1);
    expect(sdk.describeRequest?.(request.id)).toBe([
      "<document>",
      "## 正文",
      "[b1] {align:\"center\"} 年度总结",
      "[b2] 本季度的**核心指标**全部达成，[风险提示]{color:\"#FF0000\"}",
      "[b3] 表格 1×2",
      "  [b4] (1,1) 姓名",
      "  [b5] (1,2) 部门",
      "## 页眉（header）",
      "[b6] 公司名称",
      "</document>",
      "<selection>",
      "Selected b2: \"核心指标\"",
      "</selection>"
    ].join("\n"));
    sdk.releaseRequest(request.id);
    expect(sdk.describeRequest?.(request.id)).toBeUndefined();
    sdk.destroy();
    editor.destroy();
  });

  it("runs feature actions as edit operations on their target blocks", async () => {
    const editor = createStructuredEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const request = sdk.captureRequest();
    const invoke = (operationId: string, operations: unknown[]) =>
      sdk.invoke({ requestId: request.id, operationId, toolName: "document_edit", input: { operations } });
    await invoke("caption", [
      { op: "insert", before: "b1", blocks: ["开头"] },
      { op: "caption_table", block: "b3", params: { caption: "表 1" } }
    ]);
    expect(editor.state.doc.child(0).child(3).attrs.caption).toBe("表 1");
    await expect(invoke("wrong-target", [{ op: "caption_table", block: "b1", params: { caption: "x" } }]))
      .resolves.toMatchObject({ summary: expect.stringMatching(/Operation 1 \(caption_table\): target must be a block of type table/u) });
    await expect(invoke("wrong-params", [{ op: "caption_table", block: "b3", params: {} }]))
      .resolves.toMatchObject({ summary: expect.stringMatching(/No operation could be applied; nothing was changed\.[\s\S]*Operation 1 \(caption_table\): \/params must have required properties caption/u) });
    expect(sdk.tools().find(tool => tool.name === "document_edit")?.description).toMatch(/^- caption_table \(block[^\n]*— Sets the table caption\.$/mu);
    sdk.destroy();
    editor.destroy();
  });

  it("settles each operation alone: malformed ones fail, the rest apply, and operations past the limit wait", async () => {
    const editor = createStructuredEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const request = sdk.captureRequest();
    const check = (input: unknown) => sdk.checkInput({ requestId: request.id, operationId: "", toolName: "document_edit", input });
    const invoke = (operationId: string, operations: unknown[]) =>
      sdk.invoke({ requestId: request.id, operationId, toolName: "document_edit", input: { operations } });

    // Only the outer shape is checked up front; a malformed operation fails alone.
    expect(check({ operations: "x" })).toMatch(/\/operations must be array.*Nothing was changed\./u);
    expect(check({ operations: [{ op: "caption_table", block: "b3", params: {} }] })).toBeUndefined();

    const mixed = await invoke("mixed", [
      { op: "replace", block: "b1", text: "新开头" },
      { op: "caption_table", block: "b3", params: {} },
      { op: "teleport", block: "b1" }
    ]);
    expect(mixed.summary).toContain("Applied 1 of 3 operations.\nFailed — send only these again, with corrected values:");
    expect(mixed.summary).toContain("- Operation 2 (caption_table): /params must have required properties caption.");
    expect(mixed.summary).toMatch(/- Operation 3 \(teleport\): unknown operation; use one of: replace, append, replace_text, replace_all, insert, move, delete, format/u);
    expect(editor.state.doc.child(0).child(0).textContent).toBe("新开头");

    const many = await invoke("many", Array.from({ length: 201 }, (_, index) => ({ op: "replace", block: "b1", text: `第 ${index + 1} 次` })));
    expect(many.summary).toContain("Applied 200 of 201 operations.");
    expect(many.summary).toContain("Operations 201–201 were not processed: one call takes at most 200; send them in another call.");
    expect(sdk.tools().find(tool => tool.name === "document_edit")?.description).toContain("At most 200 operations per call");
    sdk.destroy();
    editor.destroy();
  });

  it("shows inline container content and refuses to rewrite blocks that hold it", async () => {
    const control = Node.create({ name: "control", group: "inline", inline: true, content: "text*" });
    const editor = new Editor({ extensions: [
      Node.create({ name: "doc", topNode: true, content: "block+" }),
      Node.create({ name: "paragraph", group: "block", content: "inline*" }), text, control
    ], content: { type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "编号：" }, { type: "control", content: [{ type: "text", text: "REF-1" }] }
    ] }] } });
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "d", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    const request = sdk.captureRequest();
    const view = await sdk.invoke({ requestId: request.id, operationId: "read", toolName: "document_read", input: {} });
    expect(view.summary).toContain("[b1] 编号：⟦REF-1⟧");
    await expect(sdk.invoke({ requestId: request.id, operationId: "replace", toolName: "document_edit", input: { operations: [{ op: "replace", block: "b1", text: "编号：REF-2" }] } }))
      .resolves.toMatchObject({ summary: expect.stringMatching(/contains embedded fields or anchors; change its text with replace_text/u) });
    await sdk.invoke({ requestId: request.id, operationId: "replace-text", toolName: "document_edit", input: { operations: [{ op: "replace_text", block: "b1", find: "⟦REF-1⟧", replace: "REF-2" }] } });
    expect(editor.state.doc.firstChild?.child(1).type.name).toBe("control");
    expect(editor.state.doc.firstChild?.child(1).textContent).toBe("REF-2");
    sdk.destroy();
    editor.destroy();
  });

  it("merges readers of one format and rejects conflicting declarations", () => {
    const strong = Mark.create({ name: "strong", addAiCapabilities: () => [{ kind: "format", name: "bold", level: "character", description: "", read: () => "strong" }] });
    const registry = compileQuireAiRegistry([bold, strong] as unknown as QuireAnyExtension[]);
    expect(registry.characterFormats).toHaveLength(1);
    expect(registry.characterFormats[0]!.read({ level: "character", marks: [] })).toBe("strong");
    const paragraphBold = Node.create({ name: "p2", addAiCapabilities: () => [{ kind: "format", name: "bold", level: "paragraph", description: "", read: () => undefined }] });
    expect(() => compileQuireAiRegistry([bold, paragraphBold] as unknown as QuireAnyExtension[])).toThrow(/both character and paragraph/u);
    const otherBody = Node.create({ name: "other", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "story" }] });
    expect(() => compileQuireAiRegistry([body, otherBody] as unknown as QuireAnyExtension[])).toThrow(/declared by both "body" and "other"/u);
  });
});

/**
 * @param editor - Structured editor.
 * @param index - Body child index.
 * @returns Position before that body child.
 */
function positionOfChild(editor: Editor, index: number): number {
  let pos = 1;
  for (let i = 0; i < index; i += 1) pos += editor.state.doc.child(0).child(i).nodeSize;
  return pos;
}

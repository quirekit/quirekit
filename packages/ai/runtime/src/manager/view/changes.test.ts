import { Editor, Mark, Node, type QuireEditor } from "@quirekit/core";
import type { Node as PMNode } from "@quirekit/pm";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { getQuireAi } from "../manager";
import { describeQuireAiChanges } from "./changes";
import { renderQuireAiDocumentView } from "./render";

const alignLabels: Readonly<Record<string, string>> = { start: "左对齐", center: "居中" };

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({
  name: "paragraph", group: "block", content: "inline*", addAttributes: () => ({ align: { default: null } }),
  addAiCapabilities: () => [{
    kind: "format", name: "align", level: "paragraph", description: "Alignment.",
    read: target => target.level === "paragraph" ? target.node.attrs.align ?? undefined : undefined,
    present: { label: "对齐", value: value => alignLabels[String(value)] ?? String(value) }
  }]
});
const bold = Mark.create({
  name: "bold",
  addAiCapabilities: () => [{
    kind: "format", name: "bold", level: "character", description: "Bold.",
    read: target => target.level === "character" && target.marks.some(mark => mark.type.name === "bold") ? true : undefined,
    present: { label: "加粗" }
  }]
});
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const note = Node.create({ name: "note", content: "paragraph+", addAiCapabilities: () => [{ kind: "structure", node: "note", role: "story", label: () => "批注 1" }] });
const store = Node.create({ name: "store", content: "note*", addAiCapabilities: () => [{ kind: "structure", node: "store", role: "store" }] });
const doc = Node.create({
  name: "doc", topNode: true, content: "body store", addAttributes: () => ({ paper: { default: "A4" } }),
  addAiCapabilities: () => [{ kind: "document-setting", name: "page", read: node => [{ label: "页面", value: `${String(node.attrs.paper)} 纵向` }] }]
});

/** @returns Editor with three body paragraphs and an empty note store. */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, store, note, paragraph, text, bold], content: { type: "doc", content: [
    { type: "body", content: [
      { type: "paragraph", content: [{ type: "text", text: "第一段" }] },
      { type: "paragraph", attrs: { align: "center" }, content: [{ type: "text", text: "核心指标全部达成" }] },
      { type: "paragraph", content: [{ type: "text", text: "第三段" }] }
    ] },
    { type: "store" }
  ] } });
}

/**
 * @param editor - Editor holding the source document.
 * @param change - Builds the candidate from the source JSON.
 * @returns Changes from the source to the candidate.
 */
function compare(editor: QuireEditor, change: (json: { content: { content?: unknown[] }[] }) => void) {
  const json = structuredClone(editor.state.doc.toJSON()) as { content: { content?: unknown[] }[] };
  change(json);
  candidate = editor.state.doc.type.schema.nodeFromJSON(json);
  return describeQuireAiChanges(editor.state.doc, candidate, getQuireAi(editor).registry);
}

/** Candidate of the latest comparison. */
let candidate: PMNode;

/**
 * @param doc - Document.
 * @param range - Range in it.
 * @returns Text the range covers.
 */
function textOf(doc: PMNode, range: { from: number; to: number }): string {
  return doc.textBetween(range.from, range.to);
}

describe("change descriptions", () => {
  it("reports rewritten text as kept, removed and inserted pieces", () => {
    const editor = createEditor();
    const changes = compare(editor, json => {
      json.content[0]!.content![1] = { type: "paragraph", attrs: { align: "center" }, content: [{ type: "text", text: "核心指标基本达成" }] };
    });
    expect(changes).toMatchObject([{ kind: "edited", excerpt: "核心指标全部达成", formats: [], text: [
      { kind: "same", text: "核心指标" }, { kind: "removed", text: "全部" }, { kind: "inserted", text: "基本" }, { kind: "same", text: "达成" }
    ] }]);
    expect(textOf(editor.state.doc, changes[0]!.source!)).toBe("核心指标全部达成");
    expect(textOf(candidate, changes[0]!.candidate!)).toBe("核心指标基本达成");
  });

  it("names format changes with their people-facing labels and values", () => {
    const editor = createEditor();
    const changes = compare(editor, json => {
      json.content[0]!.content![1] = { type: "paragraph", attrs: { align: "start" }, content: [
        { type: "text", text: "核心指标", marks: [{ type: "bold" }] }, { type: "text", text: "全部达成" }
      ] };
    });
    expect(changes).toMatchObject([{ kind: "edited", excerpt: "核心指标全部达成", formats: [
      { label: "对齐", before: "居中", after: "左对齐", toggle: false },
      { label: "加粗", before: null, after: "true", toggle: true, text: "核心指标" }
    ] }]);
  });

  it("reports whole blocks added or removed, with the story they belong to", () => {
    const editor = createEditor();
    const changes = compare(editor, json => {
      json.content[0]!.content!.splice(2, 1);
      json.content[1]!.content = [{ type: "note", content: [{ type: "paragraph", content: [{ type: "text", text: "请补充来源。" }] }] }];
    });
    expect(changes).toMatchObject([
      { kind: "removed", excerpt: "第三段", formats: [] },
      { kind: "inserted", section: "批注 1", excerpt: "请补充来源。", formats: [] }
    ]);
    const [removed, inserted] = changes;
    expect(textOf(editor.state.doc, removed!.source!)).toBe("第三段");
    expect(removed!.candidate!.from).toBe(removed!.candidate!.to);
    expect(candidate.resolve(removed!.candidate!.from).parent.textContent).toBe("核心指标全部达成");
    expect(textOf(candidate, inserted!.candidate!)).toBe("请补充来源。");
    expect(inserted!.source!.from).toBe(inserted!.source!.to);
  });

  it("opens a read from the start with the document settings, outside the block count", () => {
    const editor = createEditor();
    const manager = getQuireAi(editor);
    const first = renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { limit: 200, stories: true });
    expect(first.text.startsWith("## 文档设置\n页面：A4 纵向\n## 正文\n")).toBe(true);
    expect(first.listed).toBe(3);
    const next = renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, { from: first.blocks[1]!.id, limit: 200, stories: true });
    expect(next.text).not.toContain("文档设置");
  });

  it("lists changed settings without document ranges", () => {
    const editor = createEditor();
    const changes = compare(editor, json => { (json as { attrs?: Record<string, unknown> }).attrs = { paper: "A3" }; });
    expect(changes).toEqual([{ kind: "edited", section: "文档设置", excerpt: "页面", formats: [], text: [
      { kind: "same", text: "页面：A" }, { kind: "removed", text: "4" }, { kind: "inserted", text: "3" }, { kind: "same", text: " 纵向" }
    ] }]);
  });
});

import { Editor, Mark, Node, type QuireEditor } from "@quirekit/core";
import { describe, expect, it } from "vitest";
import type {} from "@quirekit/ai-contract";
import { quireAiReplyLanguageNote } from "../edit/settle";
import { getQuireAi } from "../manager";
import { buildQuireAiTransformOperation } from "./build";
import { decodeQuireAiSegments } from "./decode";
import type { QuireAiModelPort, QuireAiSegment } from "./types";

/**
 * @param name - Mark and format name.
 * @param attribute - Attribute holding the value, or undefined for a boolean mark.
 * @returns Mark with a character format fact.
 */
function formatMark(name: string, attribute?: string) {
  return Mark.create({
    name, ...(attribute === undefined ? {} : { addAttributes: () => ({ [attribute]: { default: null } }) }),
    addAiCapabilities: () => [{
      kind: "format", name, level: "character", description: name, schema: attribute === undefined ? { type: "boolean" } : { type: "string" },
      read: target => {
        if (target.level !== "character") return undefined;
        const mark = target.marks.find(candidate => candidate.type.name === name);
        return mark === undefined ? undefined : attribute === undefined ? true : mark.attrs[attribute];
      },
      apply: ({ tr, from, to }, value) => {
        const type = tr.doc.type.schema.marks[name]!;
        tr.removeMark(from, to, type);
        if (value !== null && value !== false) tr.addMark(from, to, type.create(attribute === undefined ? {} : { [attribute]: value }));
        return true;
      }
    }]
  });
}

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({ name: "paragraph", group: "block", content: "inline*" });
const hardBreak = Node.create({ name: "hardBreak", group: "inline", inline: true });
const body = Node.create({ name: "body", content: "block+", addAiCapabilities: () => [{ kind: "structure", node: "body", role: "body" }] });
const doc = Node.create({ name: "doc", topNode: true, content: "body" });
const size = { type: "fontSize", attrs: { value: "11pt" } };
const slot = Node.create({ name: "slot", content: "paragraph+" });
const frame = Node.create({
  name: "frame", group: "block", content: "slot+",
  addAiCapabilities: () => [{ kind: "block", node: "frame", label: () => "frame", children: node => {
    const slots: { node: typeof node; offset: number; caption: string }[] = [];
    node.forEach((child, offset, index) => slots.push({ node: child, offset, caption: `(${index + 1})` }));
    return slots;
  } }]
});

/** @returns Editor with a paragraph, a frame holding one paragraph, and a paragraph. */
function createFramedEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, paragraph, text, slot, frame], content: { type: "doc", content: [{ type: "body", content: [
    { type: "paragraph", content: [{ type: "text", text: "Intro" }] },
    { type: "frame", content: [{ type: "slot", content: [{ type: "paragraph", content: [{ type: "text", text: "Inside" }] }] }] },
    { type: "paragraph", content: [{ type: "text", text: "Outro" }] }
  ] }] } });
}

/** @param editor - Editor. @returns Text of every paragraph in document order. */
function texts(editor: QuireEditor): string[] {
  const out: string[] = [];
  editor.state.doc.descendants(node => { if (node.isTextblock) out.push(node.textContent); return true; });
  return out;
}

/** @returns Editor with a mixed-format paragraph, a symbol, an empty paragraph, a number and an address. */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, body, paragraph, text, formatMark("bold"), formatMark("fontSize", "value")], content: { type: "doc", content: [{ type: "body", content: [
    { type: "paragraph", content: [
      { type: "text", text: "Submit within ", marks: [size] },
      { type: "text", text: "21 days", marks: [size, { type: "bold" }] },
      { type: "text", text: " of the outcome.", marks: [size] }
    ] },
    { type: "paragraph", content: [{ type: "text", text: "☐" }] },
    { type: "paragraph" },
    { type: "paragraph", content: [{ type: "text", text: "2026" }] },
    { type: "paragraph", content: [{ type: "text", text: "casework@example.test" }] },
    { type: "paragraph", content: [{ type: "text", text: "Name" }] }
  ] }] } });
}

/**
 * A model that prefixes every segment with "译:" and keeps its tags.
 * @param edit - Rewrites an answer line before it is returned, per call.
 * @returns Port and the number of calls.
 */
function translator(edit: (line: string, call: number) => string | null = line => line): { model: QuireAiModelPort; calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    model: {
      async complete({ prompt }) {
        calls += 1;
        const lines = [...prompt.matchAll(/^\[(\d+)\] (.*)$/gmu)].flatMap(([, number, value]) => {
          const line = edit(`[${number}] 译:${value}`, calls);
          return line === null ? [] : [line];
        });
        return { text: ["Here you go:", ...lines].join("\n") };
      }
    }
  };
}

/**
 * @param editor - Editor.
 * @param model - Model port.
 * @param placement - Placement.
 * @param range - Optional `blocks` and `exclude` arguments.
 * @returns Tool result summary without its closing reply-language note.
 */
async function transform(editor: QuireEditor, model: QuireAiModelPort, placement: "after" | "replace", range: Record<string, unknown> = {}): Promise<string> {
  const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "transform", authorizeWrite: () => ({ allowed: true, mode: "direct" }), transform: { model } });
  const result = await sdk.invoke({ requestId: sdk.captureRequest().id, operationId: "transform", toolName: "document_transform", input: { instruction: "Translate.", placement, ...range } });
  expect(result.summary.endsWith(`\n${quireAiReplyLanguageNote}`)).toBe(true);
  return result.summary.slice(0, -quireAiReplyLanguageNote.length - 1);
}

/**
 * @param editor - Editor.
 * @returns Body paragraphs as text with `**` around bold runs and the font size of the first run.
 */
function paragraphs(editor: QuireEditor): string[] {
  const out: string[] = [];
  editor.state.doc.child(0).forEach(node => {
    let line = "";
    node.forEach(child => { line += child.marks.some(mark => mark.type.name === "bold") ? `**${child.text}**` : child.text; });
    const first = node.firstChild?.marks.find(mark => mark.type.name === "fontSize")?.attrs.value as string | undefined;
    out.push(first === undefined ? line : `${line} @${first}`);
  });
  return out;
}

describe("transform segments", () => {
  const segment: QuireAiSegment = {
    number: 1, block: "b1", text: "Submit within <t1>21 days</t1> of the outcome.",
    shared: { fontSize: "11pt" }, tags: new Map([[1, { bold: true, fontSize: "11pt" }]]), objects: 0, numbered: false
  };

  it("checks answers: keeps good ones, drops broken tags, reports missing and empty ones", () => {
    const answers = decodeQuireAiSegments("[1] 在<t1>21 天</t1>内提交\n[1] duplicate\n[2] <t1>坏的\n[3]", new Map([
      [1, segment], [2, { ...segment, number: 2 }], [3, { ...segment, number: 3 }], [4, { ...segment, number: 4 }]
    ]));
    expect(answers.get(1)).toEqual({ status: "ok", text: "在<t1>21 天</t1>内提交" });
    expect(answers.get(2)).toEqual({ status: "degraded", text: "坏的" });
    expect(answers.get(3)).toMatchObject({ status: "missing" });
    expect(answers.get(4)).toEqual({ status: "missing", reason: "the model gave no answer for it" });
  });

  it("writes the edit markup itself, escaping characters the model wrote", () => {
    expect(buildQuireAiTransformOperation(segment, "在 <t1>21*天</t1> 内[提交]", "after")).toEqual({
      op: "insert", after: "b1", blocks: [{ text: "在 [21\\*天]{bold:true} 内\\[提交\\]", like: "b1" }]
    });
    expect(buildQuireAiTransformOperation(segment, "在 <t1>21 天</t1> 内<br/>提交", "replace")).toEqual({
      op: "replace", block: "b1", text: "[在 [21 天]{bold:true} 内\u2028提交]{fontSize:\"11pt\"}"
    });
  });
});

describe("document_transform", () => {
  it("places a formatted result after every block with text and reports the task complete", async () => {
    const editor = createEditor();
    const summary = await transform(editor, translator().model, "after");

    expect(paragraphs(editor)).toEqual([
      "Submit within **21 days** of the outcome. @11pt", "译:Submit within **21 days** of the outcome. @11pt",
      "☐", "", "2026", "casework@example.test", "Name", "译:Name"
    ]);
    expect(summary).toBe([
      "Transformed 2 of 2 blocks.", "The task is complete.", "First results, to quote instead of guessing:",
      "- \"Submit within 21 days of the outcome.\" → \"译:Submit within 21 days of the outcome.\"", "- \"Name\" → \"译:Name\""
    ].join("\n"));
    editor.destroy();
  });

  it("adds nothing after a block the task leaves as it is, and says so", async () => {
    const editor = createEditor();
    const summary = await transform(editor, translator(line => line.replace("译:Name", "Name")).model, "after");

    expect(paragraphs(editor).slice(-2)).toEqual(["casework@example.test", "Name"]);
    expect(summary).toBe([
      "Transformed 1 of 2 blocks.",
      "The task is complete.",
      "Left unchanged:",
      "- block b6 \"Name\": the task leaves it as it is",
      "First results, to quote instead of guessing:",
      "- \"Submit within 21 days of the outcome.\" → \"译:Submit within 21 days of the outcome.\""
    ].join("\n"));
    editor.destroy();
  });

  it("keeps excluded blocks and everything inside them out of the run", async () => {
    const editor = createFramedEditor();
    await transform(editor, translator().model, "replace", { exclude: ["b2"] });
    expect(texts(editor)).toEqual(["译:Intro", "Inside", "译:Outro"]);
    editor.destroy();
  });

  it("limits the run to the given blocks and the blocks inside them", async () => {
    const editor = createFramedEditor();
    await transform(editor, translator().model, "replace", { blocks: ["b2"] });
    expect(texts(editor)).toEqual(["Intro", "译:Inside", "Outro"]);
    editor.destroy();
  });

  it("rewrites blocks in place with their formats", async () => {
    const editor = createEditor();
    await transform(editor, translator().model, "replace");
    expect(paragraphs(editor)[0]).toBe("译:Submit within **21 days** of the outcome. @11pt");
    editor.destroy();
  });

  it("asks again for answers that were missing, and keeps shared formats when tags stay broken", async () => {
    const editor = createEditor();
    const { model, calls } = translator((line, call) => {
      if (line.startsWith("[2]")) return call === 1 ? null : line;
      return line.replace("</t1>", "");
    });
    const summary = await transform(editor, model, "after");

    expect(calls()).toBe(2);
    expect(paragraphs(editor)[1]).toBe("译:Submit within 21 days of the outcome. @11pt");
    expect(paragraphs(editor)).toContain("译:Name");
    expect(summary.split("\n").slice(0, 2)).toEqual(["Transformed 2 of 2 blocks; 1 kept only the formatting shared by their whole paragraph.", "The task is complete."]);
    editor.destroy();
  });

  it("reports blocks the model never answered", async () => {
    const editor = createEditor();
    const summary = await transform(editor, translator(line => line.startsWith("[2]") ? null : line).model, "after");
    expect(summary).toBe([
      "Transformed 1 of 2 blocks.",
      "Not transformed — fix these with document_edit if they matter:",
      "- block b6 \"Name\": the model gave no answer for it",
      "First results, to quote instead of guessing:",
      "- \"Submit within 21 days of the outcome.\" → \"译:Submit within 21 days of the outcome.\""
    ].join("\n"));
    editor.destroy();
  });

  it("keeps line breaks inside the new paragraph", async () => {
    const editor = new Editor({ extensions: [doc, body, paragraph, text, hardBreak], content: { type: "doc", content: [{ type: "body", content: [
      { type: "paragraph", content: [{ type: "hardBreak" }, { type: "text", text: "Please give details" }] }
    ] }] } });
    await transform(editor, translator().model, "after");
    const inserted = editor.state.doc.child(0).child(1);
    expect(editor.state.doc.child(0).childCount).toBe(2);
    expect(inserted.content.content.map(node => node.type.name)).toEqual(["text", "hardBreak", "text"]);
    expect(inserted.textContent).toBe("译:Please give details");
    editor.destroy();
  });

  it("continues a stopped run without repeating the blocks it finished", async () => {
    const editor = createEditor();
    const stop = new AbortController();
    let calls = 0;
    const model: QuireAiModelPort = {
      async complete(request) {
        calls += 1;
        if (calls === 2) { stop.abort(); request.signal.throwIfAborted(); }
        return translator().model.complete(request);
      }
    };
    const sdk = getQuireAi(editor).createDocumentSdk({
      documentId: "transform", authorizeWrite: () => ({ allowed: true, mode: "direct" }), transform: { model, segmentsPerCall: 1, concurrency: 1 }
    });
    const input = { instruction: "Translate.", placement: "after" };
    await expect(sdk.invoke({ requestId: sdk.captureRequest().id, operationId: "first", toolName: "document_transform", input }, { signal: stop.signal })).rejects.toThrow();
    // What was written before the stop stays.
    expect(paragraphs(editor).filter(line => line.startsWith("译:"))).toHaveLength(1);
    const summary = (await sdk.invoke({ requestId: sdk.captureRequest().id, operationId: "again", toolName: "document_transform", input })).summary;

    expect(summary).toBe(`Continued an interrupted run: 1 blocks it had finished were skipped.\nTransformed 1 of 1 blocks.\nThe task is complete.\nFirst results, to quote instead of guessing:\n- \"Name\" → \"译:Name\"\n${quireAiReplyLanguageNote}`);
    expect(paragraphs(editor).filter(line => line.startsWith("译:"))).toHaveLength(2);
    editor.destroy();
  });

  it("continues a numbered block on a new line inside it instead of adding a numbered paragraph", async () => {
    const item = Node.create({
      name: "paragraph", group: "block", content: "inline*", addAttributes: () => ({ item: { default: null } }),
      addAiCapabilities: () => [{
        kind: "format", name: "list", level: "paragraph", description: "List item.", numbered: true, schema: { type: "boolean" },
        read: target => target.level === "paragraph" && target.node.attrs.item === true ? true : undefined
      }]
    });
    const editor = new Editor({ extensions: [doc, body, item, text, hardBreak], content: { type: "doc", content: [{ type: "body", content: [
      { type: "paragraph", attrs: { item: true }, content: [{ type: "text", text: "First step" }] },
      { type: "paragraph", content: [{ type: "text", text: "Closing" }] }
    ] }] } });
    await transform(editor, translator().model, "after");
    const blocks = editor.state.doc.child(0);
    expect(blocks.childCount).toBe(3);
    expect(blocks.child(0).content.content.map(node => node.type.name)).toEqual(["text", "hardBreak", "text"]);
    expect(blocks.child(0).textContent).toBe("First step译:First step");
    expect(blocks.child(2).textContent).toBe("译:Closing");
    editor.destroy();
  });

  it("is not offered without model access", () => {
    const editor = createEditor();
    const sdk = getQuireAi(editor).createDocumentSdk({ documentId: "transform", authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    expect(sdk.tools().map(tool => tool.name)).not.toContain("document_transform");
    editor.destroy();
  });
});

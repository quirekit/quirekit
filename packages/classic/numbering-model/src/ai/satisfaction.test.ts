import { QuireEditor } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import { WordParagraph } from "@quirekit/classic-paragraph-model";
import { describe, expect, it } from "vitest";
import { WordNumbering } from "../extension";
import { createDefaultWordNumberingRegistry } from "../model/defaults";
import type { WordParagraphNumbering } from "../types";
import { isWordListAiRangeSatisfied } from "./satisfaction";

/** @param second - Reference of the second paragraph. @returns Two canonical zero-start items. */
function createEditor(second: Partial<WordParagraphNumbering> | null = { numId: "one", level: 0 }): QuireEditor {
  const registry = createDefaultWordNumberingRegistry();
  const base = registry.abstractNums["quirekit-decimal"]!;
  const zero = { ...base, levels: { ...base.levels, "0": { ...base.levels["0"]!, start: 0 } } };
  const roman = { ...zero, id: "roman", levels: { ...zero.levels, "0": { ...zero.levels["0"]!, format: "upperRoman", text: "%1." } } };
  const bullet = { ...zero, id: "bullet", levels: { ...zero.levels, "0": { ...zero.levels["0"]!, format: "bullet", text: "•" } } };
  return new QuireEditor({ extensions: [StarterKit, WordParagraph, WordNumbering], content: {
    type: "doc", attrs: { wordNumberingRegistry: { ...registry,
      abstractNums: { ...registry.abstractNums, [base.id]: zero, roman, bullet },
      nums: { one: { id: "one", abstractNumId: base.id },
        roman: { id: "roman", abstractNumId: "roman" }, bullet: { id: "bullet", abstractNumId: "bullet" } }
    } }, content: [
      { type: "paragraph", attrs: { wordNumbering: { numId: "one", level: 0, startOverride: null, task: null } }, content: [{ type: "text", text: "first" }] },
      { type: "paragraph", attrs: { wordNumbering: second === null ? null : { startOverride: null, task: null, ...second } }, content: [{ type: "text", text: "second" }] }
    ]
  } });
}

describe("AI whole-range list satisfaction", () => {
  it("recognizes zero only at the declared run start and leaves the next item continuing", () => {
    const editor = createEditor();
    try {
      const doc = editor.state.doc;
      expect(isWordListAiRangeSatisfied({ doc, from: 1, to: doc.content.size - 1 }, { kind: "number", start: 0 })).toBe(true);
      const from = doc.child(0).nodeSize + 1;
      expect(isWordListAiRangeSatisfied({ doc, from, to: doc.content.size - 1 }, { kind: "number", start: 1 })).toBe(false);
      expect(editor.state.doc).toBe(doc);
      expect(doc.child(1).attrs.wordNumbering.startOverride).toBeNull();
    } finally { editor.destroy(); }
  });

  it.each([
    [null, { kind: "number", start: 0 }],
    [{ numId: "bullet", level: 0 }, { kind: "number", start: 0 }],
    [{ numId: "one", level: 1 }, { kind: "number", level: 0 }],
    [{ numId: "roman", level: 0 }, { kind: "number", style: "1." }],
    [null, null],
    [{ numId: "one", level: 0, task: { checked: false } }, { kind: "task", checked: true }]
  ] as const)("does not accept a mixed range (%j, %j)", (second, request) => {
    const editor = createEditor(second);
    try {
      const doc = editor.state.doc;
      expect(isWordListAiRangeSatisfied({ doc, from: 1, to: doc.content.size - 1 }, request)).toBe(false);
      expect(editor.state.doc).toBe(doc);
    } finally { editor.destroy(); }
  });
});

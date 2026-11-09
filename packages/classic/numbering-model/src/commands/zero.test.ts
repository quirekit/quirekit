import { QuireEditor, type QuireJSONContent } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import { WordParagraph } from "@quirekit/classic-paragraph-model";
import { describe, expect, it } from "vitest";
import { WordNumbering } from "../extension";
import { createDefaultWordNumberingRegistry } from "../model/defaults";
import { isWordNumberingRegistry, resolveWordParagraphNumbering } from "../model/validation";
import { resolveWordNumberingMarkers } from "../resolver/markers";
import { readWordNumberingEditTarget } from "../selection";

/** @param level - List depth. @returns A flat canonical paragraph. */
function paragraph(level: number): QuireJSONContent {
  return { type: "paragraph", attrs: {
    wordNumbering: { numId: "one", level, startOverride: null, task: null }
  }, content: [{ type: "text", text: `level ${level}` }] };
}

/** @param levels - Paragraph depths. @returns Editor with zero starts at both active levels. */
function createEditor(levels: readonly number[]): QuireEditor {
  const registry = createDefaultWordNumberingRegistry();
  const base = registry.abstractNums["quirekit-decimal"]!;
  const definition = { ...base, levels: { ...base.levels,
    "0": { ...base.levels["0"]!, start: 0 },
    "1": { ...base.levels["1"]!, start: 0, text: "%1.%2)" }
  } };
  return new QuireEditor({ extensions: [StarterKit, WordParagraph, WordNumbering], content: {
    type: "doc", attrs: { wordNumberingRegistry: { ...registry,
      abstractNums: { ...registry.abstractNums, [base.id]: definition },
      nums: { one: { id: "one", abstractNumId: base.id } }
    } }, content: levels.map(paragraph)
  } });
}

/** @param editor - Owning editor. @returns Markers in document order. */
function markers(editor: QuireEditor): string[] {
  return [...resolveWordNumberingMarkers(editor.state.doc).values()].map(value => value.text);
}

describe("zero-start numbering lifecycle", () => {
  it("advances zero counters and restores zero on an ancestor restart", () => {
    const editor = createEditor([0, 1, 1, 0, 1]);
    try {
      expect(isWordNumberingRegistry(editor.state.doc.attrs.wordNumberingRegistry)).toBe(true);
      expect(markers(editor)).toEqual(["0.", "0.0)", "0.1)", "1.", "1.0)"]);
      expect(editor.state.doc.textContent).toBe("level 0level 1level 1level 0level 1");
    } finally { editor.destroy(); }
  });

  it("restarts at zero without moving selection and preserves history and continuation", () => {
    const editor = createEditor([0, 0, 0]);
    try {
      const position = editor.state.doc.child(0).nodeSize;
      editor.commands.setTextSelection(position + 1);
      const selection = editor.state.pm.selection.toJSON();
      expect(editor.commands.restartWordNumberingAtPosition({ position, start: 0 })).toBe(true);
      expect(editor.state.pm.selection.toJSON()).toEqual(selection);
      expect(markers(editor)).toEqual(["0.", "0.", "1."]);
      expect(resolveWordParagraphNumbering(editor.state.doc.child(1).attrs.wordNumbering)?.startOverride).toBe(0);
      expect(editor.commands.undo()).toBe(true);
      expect(markers(editor)).toEqual(["0.", "1.", "2."]);
      expect(editor.commands.redo()).toBe(true);
      expect(markers(editor)).toEqual(["0.", "0.", "1."]);
      expect(editor.commands.continueWordNumbering()).toBe(true);
      expect(markers(editor)).toEqual(["0.", "1.", "2."]);
    } finally { editor.destroy(); }
  });

  it("edits definition and occurrence zero independently, rejects stale captures and clears", () => {
    const editor = createEditor([0, 0]);
    try {
      const target = readWordNumberingEditTarget(editor.state)!;
      expect(editor.commands.updateWordNumberingDefinition({ target,
        levels: [{ level: 0, format: "upperRoman", start: 0 }], startOverride: 0 })).toBe(true);
      expect(markers(editor)).toEqual([".", "I."]);
      expect(editor.commands.updateWordNumberingDefinition({ target,
        levels: [{ level: 0, start: 4 }] })).toBe(false);
      expect(editor.commands.clearWordList()).toBe(true);
      expect(editor.state.doc.child(0).attrs.wordNumbering).toBeNull();
      expect(markers(editor)).toEqual(["."]);
    } finally { editor.destroy(); }
  });

  it("accepts an explicit zero when creating a list and rejects negative starts", () => {
    const editor = createEditor([0]);
    try {
      expect(editor.commands.clearWordList()).toBe(true);
      expect(editor.commands.toggleWordOrderedList({ start: -1 })).toBe(false);
      expect(editor.commands.toggleWordOrderedList({ start: 0 })).toBe(true);
      expect(markers(editor)).toEqual(["0."]);
      expect(editor.commands.restartWordNumbering({ start: -1 })).toBe(false);
    } finally { editor.destroy(); }
  });
});

import { QuireEditor, type QuireJSONContent } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import { WordParagraph } from "@quirekit/classic-paragraph-model";
import { createDefaultWordParagraphStyleRegistry, WordStyles } from "@quirekit/classic-styles-model";
import { afterEach, describe, expect, it } from "vitest";
import { WordNumbering } from "../extension";
import { createDefaultWordNumberingRegistry } from "../model/defaults";
import type { WordNumberingRegistry } from "../types";
import { resolveWordNumberingMarkers } from "./markers";

const editors: QuireEditor[] = [];
afterEach(() => editors.splice(0).forEach(editor => editor.destroy()));

/** @param level - Paragraph depth. @param numId - Independent instance. @returns Canonical textblock. */
function paragraph(level: number, numId = "one"): QuireJSONContent {
  return { type: "paragraph", attrs: {
    wordNumbering: { numId, level, startOverride: null, task: null }
  }, content: [{ type: "text", text: `level ${level}` }] };
}

/** @param start - Common declared start. @returns Registry with nine complete levels. */
function registry(start = 0): WordNumberingRegistry {
  const base = createDefaultWordNumberingRegistry();
  const definition = base.abstractNums["quirekit-decimal"]!;
  return { ...base, abstractNums: { ...base.abstractNums, [definition.id]: {
    ...definition, levels: Object.fromEntries(Object.entries(definition.levels).map(([key, level]) => [key, { ...level, start }]))
  } }, nums: { one: { id: "one", abstractNumId: definition.id }, two: { id: "two", abstractNumId: definition.id } } };
}

/** @param content - Initial canonical content. @param numbering - Registry. @param attrs - Other document facts. @returns Tracked editor. */
function createEditor(content: QuireJSONContent[], numbering = registry(), attrs: Record<string, unknown> = {}): QuireEditor {
  const editor = new QuireEditor({ extensions: [StarterKit, WordParagraph, WordStyles, WordNumbering],
    content: { type: "doc", attrs: { ...attrs, wordNumberingRegistry: numbering }, content } });
  editors.push(editor);
  return editor;
}

/** @param editor - Canonical owner. @returns Ordered model labels. */
function labels(editor: QuireEditor): string[] {
  return [...resolveWordNumberingMarkers(editor.state.doc).values()].map(marker => marker.text);
}

describe("implicit default numbering ancestors", () => {
  it.each([0, 1])("materializes start %i before the first real parent without mutating JSON", start => {
    const editor = createEditor([1, 1, 0, 1, 1].map(level => paragraph(level)), registry(start));
    const stored = JSON.stringify(editor.getJSON());
    const markers = resolveWordNumberingMarkers(editor.state.doc);
    expect(labels(editor)).toEqual([`${start}.${start}.`, `${start}.${start + 1}.`, `${start + 1}.`,
      `${start + 1}.${start}.`, `${start + 1}.${start + 1}.`]);
    expect([...markers.values()][0]!.counterValues).toEqual([start, start]);
    expect(Object.isFrozen([...markers.values()][0]!.counterValues)).toBe(true);
    expect(resolveWordNumberingMarkers(editor.state.doc)).toBe(markers);
    expect(JSON.stringify(editor.getJSON())).toBe(stored);
  });

  it("rematerializes skipped middle ancestors after a default restart", () => {
    const editor = createEditor([2, 2, 0, 2, 1, 2].map(level => paragraph(level)));
    expect(labels(editor)).toEqual(["0.0.0.", "0.0.1.", "1.", "1.0.0.", "1.1.", "1.1.0."]);
  });

  it("retains a leaf until its explicitly declared root trigger occurs", () => {
    const source = registry();
    const definition = source.abstractNums["quirekit-decimal"]!;
    const numbering = { ...source, abstractNums: { ...source.abstractNums, [definition.id]: {
      ...definition, levels: { ...definition.levels, "2": { ...definition.levels["2"]!, restartAfterLevel: 0 } }
    } } };
    const editor = createEditor([2, 1, 2, 0, 2].map(level => paragraph(level)), numbering);
    expect(labels(editor)).toEqual(["0.0.0.", "0.1.", "0.1.1.", "1.", "1.0.0."]);
  });

  it("does not seed a never-restarting child's actual count from its implicit prefix", () => {
    const source = registry();
    const definition = source.abstractNums["quirekit-decimal"]!;
    const numbering = { ...source, abstractNums: { ...source.abstractNums, [definition.id]: {
      ...definition, levels: { ...definition.levels, "1": { ...definition.levels["1"]!, restartAfterLevel: null } }
    } } };
    const editor = createEditor([0, 2, 0, 2, 1, 2].map(level => paragraph(level)), numbering);
    const markers = [...resolveWordNumberingMarkers(editor.state.doc).values()];
    // The actual middle-level paragraph is a separate native-observed boundary.
    // Its earlier virtual prefixes must not move this first real counter from zero.
    expect(markers[4]!.text).toBe("1.0.");
    expect(markers[4]!.counter).toBe(0);
    expect(markers[5]!.text).toBe("1.0.0.");
  });

  it("keeps independent instances isolated even when they reuse the same format definition", () => {
    const editor = createEditor([paragraph(1), paragraph(0, "two"), paragraph(0)]);
    expect(labels(editor)).toEqual(["0.0.", "0.", "1."]);
  });

  it("uses effective style references and excludes explicit suppression", () => {
    const styles = createDefaultWordParagraphStyleRegistry();
    const style = { ...styles.styles.Normal!, id: "ChildList", name: "Child list", role: "custom" as const,
      default: false, basedOn: "Normal", numbering: { numId: "one", level: 1 } };
    /** @param numbering - Direct reference or suppression. @returns Style-numbered paragraph. */
    const styled = (numbering: unknown): QuireJSONContent => ({ type: "paragraph", attrs: {
      wordParagraph: { styleId: "ChildList" }, wordNumbering: numbering
    }, content: [{ type: "text", text: "style" }] });
    const editor = createEditor([styled("none"), styled(null), paragraph(0)], registry(), {
      wordStyleRegistry: { ...styles, styles: { ...styles.styles, ChildList: style } }
    });
    expect(labels(editor)).toEqual(["0.0.", "1."]);
  });

  it("does not invent absent intermediate definitions or count dangling paragraphs", () => {
    const source = registry();
    const definition = source.abstractNums["quirekit-decimal"]!;
    const levels = { ...definition.levels };
    delete levels["1"];
    const numbering = { ...source, abstractNums: { ...source.abstractNums, [definition.id]: { ...definition, levels } } };
    const editor = createEditor([paragraph(2), paragraph(1), paragraph(0)], numbering);
    const markers = [...resolveWordNumberingMarkers(editor.state.doc).values()];
    expect(markers).toHaveLength(2);
    expect(markers[0]!.counterValues).toEqual([0, undefined, 0]);
    expect(markers[1]!.text).toBe("1.");
    expect(editor.state.doc.attrs.wordNumberingRegistry.abstractNums[definition.id].levels["1"]).toBeUndefined();
  });

  it("recomputes an implicit parent after level edits, undo, redo and JSON reload", () => {
    const editor = createEditor([paragraph(0), paragraph(0)]);
    editor.commands.setTextSelection(1);
    expect(editor.commands.increaseWordListLevel()).toBe(true);
    expect(labels(editor)).toEqual(["0.0.", "1."]);
    expect(editor.commands.undo()).toBe(true);
    expect(labels(editor)).toEqual(["0.", "1."]);
    expect(editor.commands.redo()).toBe(true);
    expect(labels(editor)).toEqual(["0.0.", "1."]);
    const restored = new QuireEditor({ extensions: [StarterKit, WordParagraph, WordStyles, WordNumbering], content: editor.getJSON() });
    editors.push(restored);
    expect(labels(restored)).toEqual(labels(editor));
  });
});

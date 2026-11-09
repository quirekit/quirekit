import { describe, expect, it } from "vitest";
import { defaultWordParagraphFormatting, resolveWordParagraphFormatting } from "../model";
import { projectWordParagraphLayoutFormatting } from "./formatting";

describe("Word paragraph layout projection", () => {
  it.each([[null, null, 0.25, 0.25], [false, true, 0, 0.25], [true, false, 0.25, 0], [false, false, 0, 0]] as const)
    ("resolves script spacing defaults independently: %s/%s", (autoSpaceLatin, autoSpaceNumber, ideographAlpha, ideographNumeric) => {
      const formatting = resolveWordParagraphFormatting({ eastAsianLayout: { autoSpaceLatin, autoSpaceNumber } });
      expect(projectWordParagraphLayoutFormatting(formatting, true).autoSpacing).toEqual({ ideographAlpha, ideographNumeric });
    });
  it("enables basic punctuation by default and preserves an explicit false", () => {
    const inherited = projectWordParagraphLayoutFormatting(defaultWordParagraphFormatting, false);
    const disabled = projectWordParagraphLayoutFormatting(resolveWordParagraphFormatting({ eastAsianLayout: { kinsoku: false } }), true);
    const enabled = projectWordParagraphLayoutFormatting(resolveWordParagraphFormatting({ eastAsianLayout: { kinsoku: true } }), true);
    expect(inherited.avoidPunctuationBreaks).toBe(true);
    expect(enabled.avoidPunctuationBreaks).toBe(true);
    expect(disabled.avoidPunctuationBreaks).toBe(false);
    expect(disabled.signature).not.toBe(enabled.signature);
  });

  it("projects absolute right dot tabs without exposing Word units", () => {
    const formatting = resolveWordParagraphFormatting({ tabs: [
      { position: { unit: "dxa", value: 8296 }, alignment: "end", leader: "dot" }
    ] });
    expect(projectWordParagraphLayoutFormatting(formatting, true).tabs).toEqual({
      stops: [{ position: 8296 / 15, alignment: "end", leader: "." }]
    });
    expect(projectWordParagraphLayoutFormatting(resolveWordParagraphFormatting({ tabs: [
      { position: { unit: "dxa", value: 8296 }, alignment: "decimal" }
    ] }), true).tabs).toBeUndefined();
  });

  it('consumes clear instructions before native geometry without disabling the default grid', () => {
    const formatting = resolveWordParagraphFormatting({ tabs: [
      { position: { unit: 'dxa', value: 1440 }, alignment: 'clear' },
      { position: { unit: 'dxa', value: 2160 }, alignment: 'start' },
    ] });
    expect(projectWordParagraphLayoutFormatting(formatting, true, 720).tabs).toEqual({
      stops: [{ position: 144, alignment: 'start' }], defaultInterval: 48,
    });
    expect(formatting.tabs).toHaveLength(2);
    const cleared = resolveWordParagraphFormatting({ tabs: [
      { position: { unit: 'dxa', value: 1440 }, alignment: 'clear' },
    ] });
    expect(projectWordParagraphLayoutFormatting(cleared, true, 720).tabs).toEqual({ stops: [], defaultInterval: 48 });
    const ordered = resolveWordParagraphFormatting({ tabs: [
      { position: { unit: 'dxa', value: 720 }, alignment: 'start' },
      { position: { unit: 'dxa', value: 720 }, alignment: 'clear' },
    ] });
    expect(projectWordParagraphLayoutFormatting(ordered, true, 720).tabs).toEqual({ stops: [], defaultInterval: 48 });
  });

  it("projects an unformatted paragraph to single spacing with two-line widow control", () => {
    expect(projectWordParagraphLayoutFormatting(defaultWordParagraphFormatting, false)).toMatchObject({
      alignment: null, direction: null, snapToGrid: null, lineSpacing: null, naturalLineMetrics: false,
      pagination: { widows: 2, orphans: 2 }, markTypography: null, decoration: null
    });
  });

  it("converts line spacing, pagination flags and paragraph-mark typography", () => {
    const formatting = resolveWordParagraphFormatting({
      spacing: { line: { rule: "auto", value: 360 } },
      pagination: { widowControl: false, keepNext: true, keepLines: true, pageBreakBefore: true },
      markFormatting: { fontSizePt: 12, color: "auto", fontFamily: "Arial" }
    });
    const projected = projectWordParagraphLayoutFormatting(formatting, true);

    expect(projected.lineSpacing).toEqual({ mode: "multiple", value: 1.5 });
    expect(projected.naturalLineMetrics).toBe(true);
    expect(projected.pagination).toEqual({ breakBefore: "page", keepTogether: true, keepWithNext: true, widows: 1, orphans: 1 });
    expect(projected.markTypography).toMatchObject({ fontSize: 16, fontFamily: "Arial", color: null });
  });

  it("reports exact spacing in CSS pixels and keeps the signature stable", () => {
    const formatting = resolveWordParagraphFormatting({ spacing: { line: { rule: "exact", value: 300 } } });

    expect(projectWordParagraphLayoutFormatting(formatting, true).lineSpacing).toEqual({ mode: "exact", value: 20, exactBaselineRatio: 0.8 });
    expect(projectWordParagraphLayoutFormatting(formatting, true).signature)
      .toBe(projectWordParagraphLayoutFormatting(formatting, false).signature);
  });
});

import { describe, expect, it, vi } from "vitest";
import { layoutQuireInlineTextFragmentsFromQuireLayout } from "./quire-fragments";
import type {
  QuireShapedGlyphPlacement,
  QuireShapedTextCluster,
  QuireTextMeasurer
} from "@quirekit/layout/text";
import { resolveQuireTextFragmentRunRect } from "../text/run-geometry";
import type { QuireInlineLayoutOptions, QuireInlineTextRun } from "./types";

const fixedMeasurer: QuireTextMeasurer = {
  measureText: measureFixedText
};

describe("layoutQuireInlineTextFragmentsFromQuireLayout", () => {
  it("keeps native paint and shared caret geometry for tracked character spacing", () => {
    const shapeRun = vi.fn(() => ({
      clusters: [{ from: 0, to: 3, x: 0, advance: 24, rtl: false }],
      width: 24,
      ascent: 12,
      descent: 4,
      glyphs: [{
        glyphId: 1,
        sourceCluster: 0,
        x: 0,
        y: 0,
        xAdvance: 24,
        yAdvance: 0,
        xOffset: 0,
        yOffset: 0
      }]
    }));
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-spacing",
      rect: { x: 0, y: 0, width: 100, height: 24 },
      runs: [{
        text: "ffi",
        range: { from: 1, to: 4 },
        font: "16px sans-serif",
        letterSpacing: 2,
        marks: ["textStyle"]
      }],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: (text) => ({ width: text.length * 10, ascent: 12, descent: 4 }),
        shapeRun
      },
      lineBreakMode: "word"
    });

    expect(shapeRun).not.toHaveBeenCalled();
    expect(fragments).toHaveLength(1);
    expect(fragments[0]).toMatchObject({
      letterSpacing: 2,
      rect: { width: 36 },
      caretStops: [
        { localX: 0 },
        { localX: 12 },
        { localX: 24 },
        { localX: 36 }
      ]
    });
    expect(fragments[0]?.shapedRun).toBeUndefined();
  });

  it("projects source-run baseline shifts into fragment paint geometry", () => {
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 10, y: 20, width: 100, height: 24 },
      runs: [{
        text: "x",
        range: { from: 1, to: 2 },
        font: "10px sans-serif",
        marks: ["superscript"],
        baselineShift: 4
      }],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: (text) => ({
          width: text.length * 10,
          ascent: 7,
          descent: 2
        })
      },
      lineBreakMode: "word"
    });

    expect(fragments[0]).toMatchObject({
      font: "10px sans-serif",
      baseline: 34,
      runAscent: 7,
      runDescent: 2
    });
  });

  it("emits one fragment per run segment and keeps words together across run boundaries", () => {
    const fragments = layout({
      runs: [
        createRun("xx ", 1, "16px sans-serif", []),
        createRun("ab", 4, "16px sans-serif", []),
        createRun("cd", 6, "bold 16px sans-serif", ["strong"])
      ],
      rect: { x: 10, y: 20, width: 60, height: 24 }
    });

    expect(fragments).toEqual([
      expect.objectContaining({
        text: "xx ",
        range: { from: 1, to: 4 },
        rect: expect.objectContaining({ x: 10, y: 20, width: 30 })
      }),
      expect.objectContaining({
        text: "ab",
        range: { from: 4, to: 6 },
        rect: expect.objectContaining({ x: 10, y: 44, width: 20 }),
        font: "16px sans-serif"
      }),
      expect.objectContaining({
        text: "cd",
        range: { from: 6, to: 8 },
        rect: expect.objectContaining({ x: 30, y: 44, width: 20 }),
        font: "bold 16px sans-serif",
        marks: ["strong"]
      })
    ]);
  });

  it("projects renderer row slots into exact document-space fragments", () => {
    const fragments = layout({
      runs: [createRun("aa bb cc", 1, "16px sans-serif", [])],
      rect: { x: 10, y: 20, width: 100, height: 24 },
      lineSlots: [[
        { x: 0, width: 30 },
        { x: 70, width: 30 }
      ]]
    });

    expect(fragments.map((fragment) => ({
      text: fragment.text,
      x: fragment.rect.x,
      y: fragment.rect.y,
      range: fragment.range
    }))).toEqual([{
      text: "aa ",
      x: 10,
      y: 20,
      range: { from: 1, to: 4 }
    }, {
      text: "bb ",
      x: 80,
      y: 20,
      range: { from: 4, to: 7 }
    }, {
      text: "cc",
      x: 10,
      y: 44,
      range: { from: 7, to: 9 }
    }]);
  });

  it("omits the marks key for an unmarked run segment", () => {
    const [fragment] = layout({
      runs: [createRun("ab", 1, "16px sans-serif", [])],
      rect: { x: 0, y: 0, width: 100, height: 24 }
    });

    expect(fragment && "marks" in fragment).toBe(false);
  });

  it("falls back to grapheme breaks for an overlong run", () => {
    const fragments = layout({
      runs: [createRun("abcdef", 1, "16px sans-serif", [])],
      rect: { x: 10, y: 20, width: 30, height: 24 }
    });

    expect(fragments.map((fragment) => fragment.text)).toEqual(["abc", "def"]);
    expect(fragments.map((fragment) => fragment.range)).toEqual([
      { from: 1, to: 4 },
      { from: 4, to: 7 }
    ]);
  });

  it("breaks CJK text between grapheme clusters", () => {
    const fragments = layout({
      runs: [createRun("你好世界", 1, "16px sans-serif", [])],
      rect: { x: 10, y: 20, width: 20, height: 24 }
    });

    expect(fragments.map((fragment) => fragment.text)).toEqual(["你好", "世界"]);
    expect(fragments.map((fragment) => fragment.rect.y)).toEqual([20, 44]);
  });

  it("keeps NBSP-glued text on one overflowing line", () => {
    const nbsp = String.fromCharCode(0x00a0);
    const fragments = layout({
      runs: [createRun(`aa${nbsp}bb`, 1, "16px sans-serif", [])],
      rect: { x: 10, y: 20, width: 30, height: 24 }
    });

    expect(fragments.map((fragment) => fragment.text)).toEqual([`aa${nbsp}bb`]);
    expect(fragments[0]).toEqual(
      expect.objectContaining({ range: { from: 1, to: 6 } })
    );
  });

  it("breaks ordinary hyphenated words after the hyphen", () => {
    const fragments = layout({
      runs: [createRun("aa-bb", 1, "16px sans-serif", [])],
      rect: { x: 10, y: 20, width: 40, height: 24 }
    });

    expect(fragments.map((fragment) => fragment.text)).toEqual(["aa-", "bb"]);
    expect(fragments.map((fragment) => fragment.range)).toEqual([
      { from: 1, to: 4 },
      { from: 4, to: 6 }
    ]);
    expect(fragments.map((fragment) => fragment.rect.y)).toEqual([20, 44]);
  });

  it("clamps a fragment range to a run whose text exceeds its document range", () => {
    const fragments = layout({
      runs: [
        createRun("ab", 1, "16px sans-serif", []),
        { text: "你", range: { from: 3, to: 3 }, font: "16px sans-serif", marks: [] },
        createRun("cd", 3, "16px sans-serif", [])
      ],
      rect: { x: 10, y: 20, width: 100, height: 24 }
    });

    expect(fragments).toEqual([
      expect.objectContaining({ text: "ab", range: { from: 1, to: 3 } }),
      expect.objectContaining({ text: "你", range: { from: 3, to: 3 } }),
      expect.objectContaining({ text: "cd", range: { from: 3, to: 5 } })
    ]);
  });

  it("returns no fragments for an empty paragraph with no runs", () => {
    const fragments = layout({
      runs: [],
      rect: { x: 10, y: 20, width: 100, height: 24 }
    });

    expect(fragments).toEqual([]);
  });

  it("paints from the layout's shaped glyphs without re-shaping the fragment text", () => {
    // A right-to-left run shaped by the measurer: HarfBuzz emits the buffer
    // leftmost-first, so the leftmost glyph is the logically-last character.
    let shapeCalls = 0;
    const shapingMeasurer: QuireTextMeasurer = {
      measureText: measureFixedText,
      shapeRun: (text) => {
        shapeCalls += 1;
        const chars = [...text];
        const count = chars.length;
        return {
          clusters: chars.map((_, index) => ({
            from: index,
            to: index + 1,
            x: index * 10,
            advance: 10,
            rtl: true
          })),
          width: count * 10,
          ascent: 0,
          descent: 0,
          glyphCoverage: "complete" as const,
          glyphs: chars.map((_, visualIndex) => {
            const logical = count - 1 - visualIndex;
            return {
              glyphId: 1000 + logical,
              sourceCluster: logical,
              x: visualIndex * 10,
              y: 0,
              xAdvance: 10,
              yAdvance: 0,
              xOffset: 0,
              yOffset: 0
            };
          })
        };
      }
    };

    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 10, y: 20, width: 1000, height: 24 },
      runs: [createRun("אבג", 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: shapingMeasurer,
      lineBreakMode: "word"
    });

    expect(fragments).toHaveLength(1);
    const fragment = fragments[0]!;
    // The layout shaped the run once (per itemized segment); the fragment is NOT
    // shaped a second time — its glyphs come straight from the single pass.
    expect(shapeCalls).toBe(1);
    expect(fragment.shapedRun?.glyphCoverage).toBe("complete");
    expect(fragment.shapedRun?.glyphs).toEqual([
      { glyphId: 1002, sourceCluster: 2, x: 0, y: 0, xAdvance: 10, yAdvance: 0, xOffset: 0, yOffset: 0 },
      { glyphId: 1001, sourceCluster: 1, x: 10, y: 0, xAdvance: 10, yAdvance: 0, xOffset: 0, yOffset: 0 },
      { glyphId: 1000, sourceCluster: 0, x: 20, y: 0, xAdvance: 10, yAdvance: 0, xOffset: 0, yOffset: 0 }
    ]);
  });

  it("uses native metrics for short simple Latin text even when a shaper is available", () => {
    const shapeRun = vi.fn(shapeFlLigatureTextRun);
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 10, y: 20, width: 1000, height: 24 },
      runs: [createRun("plain text", 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedText,
        shapeRun
      },
      lineBreakMode: "word"
    });

    expect(shapeRun).not.toHaveBeenCalled();
    expect(fragments).toHaveLength(1);
    expect("shapedRun" in fragments[0]!).toBe(false);
  });

  it("passes an explicit run language and resolved direction to shaping", () => {
    const contexts: unknown[] = [];
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-language",
      rect: { x: 0, y: 0, width: 200, height: 24 },
      runs: [{
        text: "Latin",
        range: { from: 1, to: 6 },
        font: "16px sans-serif",
        language: "en-US",
        marks: ["textStyle"]
      }],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedText,
        shapeRun(text, _font, context) {
          contexts.push(context);
          return {
            clusters: [...text].map((_, index) => ({
              from: index,
              to: index + 1,
              x: index * 10,
              advance: 10,
              rtl: false
            })),
            width: text.length * 10,
            ascent: 12,
            descent: 4
          };
        }
      },
      lineBreakMode: "word"
    });

    expect(contexts).toEqual([{ language: "en-US", direction: "ltr" }]);
    expect(fragments[0]).toMatchObject({
      text: "Latin",
      language: "en-US",
      runAscent: 12,
      runDescent: 4
    });
  });

  it("keeps language-aware shaping with tracked grapheme advances", () => {
    const contexts: unknown[] = [];
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-language-spacing",
      rect: { x: 0, y: 0, width: 200, height: 24 },
      runs: [{
        text: "abc",
        range: { from: 1, to: 4 },
        font: "16px sans-serif",
        language: "en-US",
        letterSpacing: 2,
        marks: ["textStyle"]
      }],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: (text) => ({
          width: text.length * 10,
          ascent: 12,
          descent: 4
        }),
        shapeRun(text, _font, context) {
          contexts.push(context);
          return {
            clusters: Array.from(text).map((_, index) => ({
              from: index,
              to: index + 1,
              x: index * 10,
              advance: 10,
              rtl: false
            })),
            width: text.length * 10,
            ascent: 12,
            descent: 4
          };
        }
      },
      lineBreakMode: "word"
    });

    expect(contexts).toEqual([{
      language: "en-US",
      direction: "ltr",
      disableOptionalLigatures: true
    }]);
    expect(fragments[0]).toMatchObject({
      language: "en-US",
      letterSpacing: 2,
      rect: { width: 36 },
      caretStops: [
        { localX: 0 },
        { localX: 12 },
        { localX: 24 },
        { localX: 36 }
      ]
    });
  });

  it("keeps native-metric Latin runs in content-grown line boxes when a shaper is available", () => {
    const shapeRun = vi.fn(shapeFlLigatureTextRun);
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 10, y: 20, width: 1000, height: 24 },
      runs: [
        createRun("Absolute ", 1, "16px sans-serif", []),
        createRun("28px", 10, "28px sans-serif", ["textStyle"]),
        createRun(" and 13px", 14, "13px sans-serif", ["textStyle"])
      ],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedTextWithFontMetrics,
        shapeRun
      },
      lineBreakMode: "word"
    });

    expect(shapeRun).not.toHaveBeenCalled();
    expect(fragments.map((fragment) => fragment.rect.height)).toEqual([34, 34, 34]);
    expect(fragments.map((fragment) => fragment.baseline)).toEqual([46, 46, 46]);
  });

  it("grows minimum line boxes for over- and under-side emphasis marks", () => {
    /**
     * Lays out one emphasis-mark run with minimum line spacing.
     *
     * @param emphasisMark - Visible emphasis-mark kind to measure.
     * @returns Fragments produced for the marked run.
     */
    const createEmphasisFragments = (
      emphasisMark: NonNullable<QuireInlineTextRun["emphasisMark"]>
    ) => layoutQuireInlineTextFragmentsFromQuireLayout({
      id: `paragraph-${emphasisMark}`,
      rect: { x: 10, y: 20, width: 1000, height: 24 },
      runs: [{
        ...createRun("字", 1, "28px sans-serif", ["textStyle"]),
        emphasisMark
      }],
      lineHeight: 24,
      lineHeightMode: "minimum",
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedTextWithFontMetrics
      },
      lineBreakMode: "word"
    });

    const dot = createEmphasisFragments("dot")[0]!;
    const underDot = createEmphasisFragments("underDot")[0]!;

    expect(dot.rect.height).toBeCloseTo(40.16);
    expect(dot.baseline).toBeCloseTo(52.16);
    expect(dot.runAscent).toBeCloseTo(32.16);
    expect(dot.runDescent).toBe(8);
    expect(underDot.rect.height).toBeCloseTo(40.16);
    expect(underDot.baseline).toBe(46);
    expect(underDot.runAscent).toBe(26);
    expect(underDot.runDescent).toBeCloseTo(14.16);
  });

  it("keeps exact line boxes fixed when emphasis marks overflow the strut", () => {
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-exact-emphasis",
      rect: { x: 10, y: 20, width: 1000, height: 24 },
      runs: [{
        ...createRun("字", 1, "28px sans-serif", ["textStyle"]),
        emphasisMark: "circle"
      }],
      lineHeight: 24,
      lineHeightMode: "exact",
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedTextWithFontMetrics
      },
      lineBreakMode: "word"
    });

    expect(fragments[0]).toEqual(expect.objectContaining({
      rect: expect.objectContaining({ y: 20, height: 24 }),
      baseline: 38
    }));
  });

  it("keeps legacy glyph effects out of measurement and caret topology", () => {
    /**
     * Lays out the same source text with an optional paint-only effect set.
     *
     * @param glyphEffects - Effect set to retain on the output fragment.
     * @returns First measured fragment.
     */
    const layout = (
      glyphEffects?: QuireInlineTextRun["glyphEffects"]
    ) => layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-effects",
      rect: { x: 10, y: 20, width: 38, height: 24 },
      runs: [{
        ...createRun("AB 中文 CD", 1, "16px sans-serif", ["textStyle"]),
        ...(glyphEffects === undefined ? {} : { glyphEffects })
      }],
      lineHeight: 24,
      lineHeightMode: "minimum",
      textBaselineOffset: 18,
      textMeasurer: fixedMeasurer,
      lineBreakMode: "word"
    });

    const plain = layout();
    const effected = layout(["outline", "shadow", "emboss", "imprint"]);

    expect(effected.map((fragment) => ({
      range: fragment.range,
      rect: fragment.rect,
      baseline: fragment.baseline,
      caretStops: fragment.caretStops
    }))).toEqual(plain.map((fragment) => ({
      range: fragment.range,
      rect: fragment.rect,
      baseline: fragment.baseline,
      caretStops: fragment.caretStops
    })));
    expect(effected.every((fragment) =>
      fragment.glyphEffects?.join("|") === "outline|shadow|emboss|imprint"
    )).toBe(true);
  });

  it("excludes collapsed hidden text before wrapping while retaining source carets", () => {
    const visibleRuns: readonly QuireInlineTextRun[] = [
      createRun("AB", 1, "16px sans-serif", []),
      createRun("CD", 9, "16px sans-serif", [])
    ];
    const plain = layout({
      runs: visibleRuns,
      rect: { x: 10, y: 20, width: 40, height: 24 }
    });
    const hidden = layout({
      runs: [
        visibleRuns[0]!,
        {
          text: "HIDDEN",
          range: { from: 3, to: 9 },
          font: "64px serif",
          hiddenText: "collapsed",
          marks: ["textStyle"]
        },
        visibleRuns[1]!
      ],
      rect: { x: 10, y: 20, width: 40, height: 24 }
    });
    const visibleHidden = hidden.filter((fragment) => fragment.hiddenText !== "collapsed");
    const collapsed = hidden.find((fragment) => fragment.hiddenText === "collapsed");

    expect(visibleHidden.map((fragment) => ({
      text: fragment.text,
      rect: fragment.rect,
      baseline: fragment.baseline
    }))).toEqual(plain.map((fragment) => ({
      text: fragment.text,
      rect: fragment.rect,
      baseline: fragment.baseline
    })));
    expect(collapsed).toMatchObject({
      text: "",
      range: { from: 3, to: 9 },
      rect: { x: 30, y: 20, width: 0, height: 24 },
      lineHeight: 24,
      baseline: 38
    });
    expect(collapsed?.caretStops.map((stop) => [
      stop.position.pos,
      stop.localX
    ])).toEqual([
      [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0]
    ]);
  });

  it("keeps an all-hidden paragraph editable on the ordinary empty line box", () => {
    const fragments = layout({
      runs: [{
        text: "秘密",
        range: { from: 1, to: 3 },
        font: "72px serif",
        hiddenText: "collapsed",
        marks: ["textStyle"]
      }],
      rect: { x: 10, y: 20, width: 100, height: 24 }
    });

    expect(fragments).toEqual([
      expect.objectContaining({
        text: "",
        range: { from: 1, to: 3 },
        rect: { x: 10, y: 20, width: 0, height: 24 },
        baseline: 38,
        hiddenText: "collapsed",
        caretStops: [
          { position: { pos: 1, bias: 1 }, localX: 0 },
          { position: { pos: 2, bias: 0 }, localX: 0 },
          { position: { pos: 3, bias: -1 }, localX: 0 }
        ]
      })
    ]);
  });

  it("forwards external first-line ascent into fragment and following-line geometry", () => {
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 10, y: 20, width: 30, height: 24 },
      runs: [createRun("aa bb", 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      lineMetricContributions: [{ ascent: 30 }],
      textMeasurer: fixedMeasurer,
      lineBreakMode: "word"
    });

    expect(fragments.map((fragment) => ({
      y: fragment.rect.y,
      height: fragment.rect.height,
      baseline: fragment.baseline
    }))).toEqual([
      { y: 20, height: 36, baseline: 50 },
      { y: 56, height: 24, baseline: 74 }
    ]);
  });

  it("shapes only Latin ligature islands inside an ordinary run", () => {
    const shapedTexts: string[] = [];
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 10, y: 20, width: 1000, height: 24 },
      runs: [createRun("Paragraph fixture", 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedText,
        shapeRun: (text) => {
          shapedTexts.push(text);
          return shapeFlLigatureTextRun(text);
        }
      },
      lineBreakMode: "word"
    });

    expect(shapedTexts).toEqual(["fi"]);
    expect(fragments.map((fragment) => fragment.text).join("")).toBe("Paragraph fixture");
  });

  it("keeps Latin line breaks stable when a CJK suffix is inserted", () => {
    const text = "Section 19c: the page-stack mounts a content and overlay canvas only for the pages intersecting the viewport plus the scroll buffer, so layout stays stable";
    const suffix = "你好";
    const shapeRun = vi.fn(shapeNarrowTextRun);
    const baseFragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 10, y: 20, width: 260, height: 24 },
      runs: [createRun(text, 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedText,
        shapeRun
      },
      lineBreakMode: "word"
    });
    shapeRun.mockClear();

    const mixedFragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 10, y: 20, width: 260, height: 24 },
      runs: [createRun(`${text}${suffix}`, 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedText,
        shapeRun
      },
      lineBreakMode: "word"
    });

    const shapedTexts = shapeRun.mock.calls.map(([value]) => value);
    const baseLines = collectLineText(baseFragments);
    const mixedPrefixLines = collectLineText(mixedFragments).slice(0, baseLines.length);
    const lastPrefixLineIndex = mixedPrefixLines.length - 1;
    mixedPrefixLines[lastPrefixLineIndex] =
      mixedPrefixLines[lastPrefixLineIndex]!.replace(suffix, "");

    expect(shapedTexts.some((value) => value.includes("Section 19c"))).toBe(false);
    expect(shapedTexts.join("")).toContain(suffix);
    expect(mixedPrefixLines).toEqual(baseLines);
    expect(mixedFragments.map((fragment) => fragment.text).join("")).toBe(`${text}${suffix}`);
  });

  it("does not pre-measure a ligature-capable run when the shaper supplies layout metrics", () => {
    const measureText = vi.fn(measureFixedText);
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 10, y: 20, width: 1000, height: 24 },
      runs: [createRun("fl", 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText,
        shapeRun: (text) => ({
          clusters: Array.from(text).map((_, index) => ({
            from: index,
            to: index + 1,
            x: index * 10,
            advance: 10,
            rtl: false
          })),
          width: text.length * 10,
          ascent: 26,
          descent: 8,
          glyphs: []
        })
      },
      lineBreakMode: "word"
    });

    expect(measureText).not.toHaveBeenCalled();
    expect(fragments[0]).toEqual(
      expect.objectContaining({
        rect: expect.objectContaining({ height: 34 }),
        baseline: 46,
        runAscent: 26,
        runDescent: 8
      })
    );
  });

  it("keeps each run's visual box when a taller sibling grows the line", () => {
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 10, y: 20, width: 1000, height: 24 },
      runs: [
        createRun("small", 1, "13px sans-serif", []),
        createRun("TALL", 6, "28px sans-serif", [])
      ],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedTextWithFontMetrics
      },
      lineBreakMode: "word"
    });

    expect(fragments).toHaveLength(2);
    expect(fragments[0]).toEqual(
      expect.objectContaining({
        rect: expect.objectContaining({ y: 20, height: 34 }),
        baseline: 46,
        runAscent: 12,
        runDescent: 4
      })
    );
    expect(fragments[1]).toEqual(
      expect.objectContaining({
        rect: expect.objectContaining({ y: 20, height: 34 }),
        baseline: 46,
        runAscent: 26,
        runDescent: 8
      })
    );
    expect(resolveQuireTextFragmentRunRect(fragments[0]!)).toEqual(
      expect.objectContaining({ y: 34, height: 16 })
    );
    expect(resolveQuireTextFragmentRunRect(fragments[1]!)).toEqual(
      expect.objectContaining({ y: 20, height: 34 })
    );
  });

  it("keeps a baseline-bearing inline replacement on the surrounding text baseline", () => {
    const fragments = layout({
      runs: [
        createRun("第 ", 1, "16px sans-serif", []),
        {
          text: "\ufffc",
          range: { from: 3, to: 4 },
          font: "16px sans-serif",
          marks: [],
          replacement: {
            sourceAnchorId: "page-field",
            inlineSize: 10,
            blockSize: 24,
            baselineOffset: 18
          }
        },
        createRun(" 页", 4, "16px sans-serif", [])
      ],
      rect: { x: 10, y: 20, width: 200, height: 24 }
    });

    expect(fragments.map((fragment) => fragment.baseline)).toEqual([38, 38, 38]);
    expect(fragments[1]).toEqual(expect.objectContaining({
      runAscent: 18,
      runDescent: 6
    }));
  });

  it("ends an inline object fragment after a multi-position source node", () => {
    // A phonetic guide holding base text spans 2..5 but paints one replacement character.
    const fragments = layout({
      runs: [
        createRun("A", 1, "16px sans-serif", []),
        { text: "\ufffc", range: { from: 2, to: 5 }, font: "16px sans-serif", marks: [],
          replacement: { sourceAnchorId: "guide", inlineSize: 20, blockSize: 24 } },
        createRun("B", 5, "16px sans-serif", [])
      ],
      rect: { x: 10, y: 20, width: 200, height: 24 }
    });
    const guide = fragments[1]!;

    expect(guide.range).toEqual({ from: 2, to: 5 });
    expect(guide.caretStops?.map((stop) => stop.position.pos)).toEqual([2, 5]);
  });

  it("forwards a minimum-line step after an inline replacement grows the line", () => {
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-grid-image",
      rect: { x: 10, y: 20, width: 200, height: 21.2 },
      runs: [{
        text: "\ufffc",
        range: { from: 1, to: 2 },
        font: "16px sans-serif",
        marks: [],
        replacement: {
          sourceAnchorId: "inline-image",
          inlineSize: 80,
          blockSize: 88.45
        }
      }],
      lineHeight: 21.2,
      lineHeightMode: "minimum",
      lineHeightStep: 21.2,
      textBaselineOffset: 15.55,
      textMeasurer: fixedMeasurer,
      lineBreakMode: "word"
    });

    expect(fragments[0]).toMatchObject({
      rect: { y: 20, height: 106 },
      baseline: 108.45,
      runAscent: 88.45,
      runDescent: 0
    });
  });

  it("forwards paragraph-end metrics to only the final wrapped line", () => {
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-mark-final-line",
      rect: { x: 10, y: 20, width: 10, height: 24 },
      runs: [createRun("AB", 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      finalLineMetricContribution: { ascent: 30, descent: 10 },
      textMeasurer: fixedMeasurer,
      lineBreakMode: "anywhere"
    });

    expect(fragments.map((fragment) => ({
      text: fragment.text,
      y: fragment.rect.y,
      height: fragment.rect.height,
      baseline: fragment.baseline
    }))).toEqual([
      { text: "A", y: 20, height: 24, baseline: 38 },
      { text: "B", y: 44, height: 40, baseline: 74 }
    ]);
  });

  it("uses native metrics instead of whole-run shaping for very long plain text", () => {
    const shapeRun = vi.fn(shapeFlLigatureTextRun);
    const text = Array.from({ length: 360 }, () => "plain repeat text ").join("");
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 0, y: 0, width: 160, height: 24 },
      runs: [createRun(text, 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedText,
        shapeRun
      },
      lineBreakMode: "word"
    });

    expect(shapeRun).not.toHaveBeenCalled();
    expect(fragments.map((fragment) => fragment.text).join("")).toBe(text);
  });

  it("memoizes repeated native metric reads inside one inline layout pass", () => {
    const measureText = vi.fn(measureFixedText);
    const text = Array.from({ length: 20 }, () => "alpha beta ").join("");
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 0, y: 0, width: 120, height: 24 },
      runs: [createRun(text, 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText,
        shapeRun: shapeFlLigatureTextRun
      },
      lineBreakMode: "word",
      forceNativeMetricLayout: true
    });

    expect(fragments.map((fragment) => fragment.text).join("")).toBe(text);
    expect(measureText.mock.calls.filter(([value]) => value === "alpha"))
      .toHaveLength(1);
    expect(measureText.mock.calls.filter(([value]) => value === "a"))
      .toHaveLength(1);
  });

  it("keeps shaping enabled when a long plain run is mixed with complex text", () => {
    const shapeRun = vi.fn(shapeFlLigatureTextRun);
    const text = Array.from({ length: 360 }, () => "plain repeat text ").join("");
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 0, y: 0, width: 260, height: 24 },
      runs: [
        createRun(text, 1, "16px sans-serif", []),
        createRun("שלום", text.length + 1, "16px sans-serif", [])
      ],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedText,
        shapeRun
      },
      lineBreakMode: "word"
    });

    expect(shapeRun).toHaveBeenCalled();
    expect(fragments.map((fragment) => fragment.text).join("")).toBe(`${text}שלום`);
  });

  it("splits partial glyph coverage into stable fragments before display-list generation", () => {
    const partialCoverageMeasurer: QuireTextMeasurer = {
      measureText: (text) => ({ width: text.length * 10 }),
      shapeRun: () => ({
        clusters: [
          { from: 0, to: 1, x: 0, advance: 11, rtl: false },
          { from: 1, to: 2, x: 11, advance: 20, rtl: false },
          { from: 2, to: 3, x: 31, advance: 13, rtl: false }
        ],
        width: 44,
        ascent: 0,
        descent: 0,
        glyphCoverage: "partial" as const,
        glyphs: [
          {
            glyphId: 65,
            sourceCluster: 0,
            x: 0,
            y: 0,
            xAdvance: 11,
            yAdvance: 0,
            xOffset: 0,
            yOffset: 0,
            fontId: "latin",
            fontFamily: "Latin Fixture"
          },
          {
            glyphId: 66,
            sourceCluster: 2,
            x: 31,
            y: 0,
            xAdvance: 13,
            yAdvance: 0,
            xOffset: 0,
            yOffset: 0,
            fontId: "latin",
            fontFamily: "Latin Fixture"
          }
        ]
      })
    };

    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 10, y: 20, width: 1000, height: 24 },
      runs: [createRun("अआइ", 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: partialCoverageMeasurer,
      lineBreakMode: "word"
    });

    expect(fragments).toEqual([
      expect.objectContaining({
        text: "अ",
        range: { from: 1, to: 2 },
        rect: expect.objectContaining({ x: 10, width: 11 }),
        shapedRun: expect.objectContaining({
          glyphCoverage: "complete",
          glyphs: [
            expect.objectContaining({ glyphId: 65, sourceCluster: 0, x: 0 })
          ]
        })
      }),
      expect.objectContaining({
        text: "आ",
        range: { from: 2, to: 3 },
        rect: expect.objectContaining({ x: 21, width: 20 })
      }),
      expect.objectContaining({
        text: "इ",
        range: { from: 3, to: 4 },
        rect: expect.objectContaining({ x: 41, width: 13 }),
        shapedRun: expect.objectContaining({
          glyphCoverage: "complete",
          glyphs: [
            expect.objectContaining({ glyphId: 66, sourceCluster: 0, x: 0 })
          ]
        })
      })
    ]);
    expect("shapedRun" in fragments[1]!).toBe(false);
  });

  it("interpolates the caret between the components of a ligature", () => {
    // Arabic لا shapes to one glyph spanning both source codepoints; the caret
    // between lam and alef sits at the ligature midpoint, not snapped to an edge.
    const ligatureMeasurer: QuireTextMeasurer = {
      measureText: measureFixedText,
      shapeRun: (text) => ({
        clusters: [{ from: 0, to: text.length, x: 0, advance: text.length * 10, rtl: true }],
        width: text.length * 10,
        ascent: 0,
        descent: 0,
        glyphCoverage: "complete" as const,
        glyphs: [
          { glyphId: 9000, sourceCluster: 0, x: 0, y: 0, xAdvance: text.length * 10, yAdvance: 0, xOffset: 0, yOffset: 0 }
        ]
      })
    };

    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 0, y: 0, width: 1000, height: 24 },
      runs: [createRun("لا", 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: ligatureMeasurer,
      lineBreakMode: "word"
    });

    expect(fragments).toHaveLength(1);
    // Right-to-left: before-lam at the right edge, after-alef at the left, the
    // internal position interpolated to the ligature midpoint.
    expect(fragments[0]!.caretStops).toEqual([
      { position: { pos: 3, bias: -1 }, localX: 0 },
      { position: { pos: 2, bias: 0 }, localX: 10 },
      { position: { pos: 1, bias: 1 }, localX: 20 }
    ]);
  });

  it("keeps an fl ligature component with its base when wrapping a long word", () => {
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 0, y: 0, width: 20, height: 24 },
      runs: [createRun("flowing", 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedText,
        shapeRun: shapeFlLigatureTextRun
      },
      lineBreakMode: "word"
    });

    expect(fragments.map((fragment) => fragment.text).join("")).toBe("flowing");
    expect(fragments.map((fragment) => fragment.text)).toEqual([
      "fl",
      "ow",
      "in",
      "g"
    ]);
    expect(fragments).not.toContainEqual(
      expect.objectContaining({ text: "l", rect: expect.objectContaining({ width: 0 }) })
    );
  });

  it("never drops fl ligature components across narrow paragraph widths", () => {
    const text = " 58 keeps flowing through the ";
    for (let width = 8; width <= 120; width += 1) {
      const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
        id: "paragraph-0",
        rect: { x: 0, y: 0, width, height: 24 },
        runs: [createRun(text, 1, "16px sans-serif", [])],
        lineHeight: 24,
        textBaselineOffset: 18,
        textMeasurer: {
          measureText: measureFixedText,
          shapeRun: shapeFlLigatureTextRun
        },
        lineBreakMode: "word"
      });

      expect(fragments.map((fragment) => fragment.text).join("")).toBe(text);
      expect(fragments.some((fragment) => fragment.text.includes("fowing"))).toBe(false);
      expect(fragments).not.toContainEqual(
        expect.objectContaining({ text: "l", rect: expect.objectContaining({ width: 0 }) })
      );
    }
  });

  it("keeps a partial-coverage fl ligature component in the painted fragment", () => {
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 0, y: 0, width: 1000, height: 24 },
      runs: [createRun("flowing", 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: {
        measureText: measureFixedText,
        shapeRun: shapePartialFlLigatureTextRun
      },
      lineBreakMode: "word"
    });

    expect(fragments.map((fragment) => fragment.text).join("")).toBe("flowing");
    expect(fragments.map((fragment) => fragment.text)).toEqual(["fl", "owing"]);
    expect(fragments).not.toContainEqual(
      expect.objectContaining({ text: "l", rect: expect.objectContaining({ width: 0 }) })
    );
  });

  it("preserves consecutive spaces so each advances the caret and renders", () => {
    // Editable inline text keeps every typed space — between words and trailing —
    // so each advances the caret and stays painted; none appear dropped.
    const fragments = layoutQuireInlineTextFragmentsFromQuireLayout({
      id: "paragraph-0",
      rect: { x: 0, y: 0, width: 1000, height: 24 },
      runs: [createRun("a  b  ", 1, "16px sans-serif", [])],
      lineHeight: 24,
      textBaselineOffset: 18,
      textMeasurer: fixedMeasurer,
      lineBreakMode: "word"
    });

    expect(fragments).toHaveLength(1);
    const fragment = fragments[0]!;
    expect(fragment.text).toBe("a  b  ");
    expect(fragment.caretStops.map((stop) => stop.position.pos)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(fragment.caretStops.map((stop) => stop.localX)).toEqual([0, 10, 20, 30, 40, 50, 60]);
  });

  it("anchors a caret on the empty line left by a trailing newline", () => {
    const fragments = layout({
      runs: [createRun("a\n", 1, "16px sans-serif", [])],
      rect: { x: 10, y: 20, width: 100, height: 24 }
    });

    expect(fragments).toHaveLength(2);
    expect(fragments[1]).toEqual(
      expect.objectContaining({
        text: "",
        rect: expect.objectContaining({ x: 10, y: 44, width: 0 }),
        caretStops: [{ position: { pos: 3, bias: 1 }, localX: 0 }]
      })
    );
  });
});

/**
 * Lays out inline runs through the QuireTextLayout-backed fragment builder.
 *
 * @param parts - Runs and layout rectangle, with default measurement metrics.
 * @returns Wrapped measured text fragments.
 */
function layout(parts: Pick<
  QuireInlineLayoutOptions,
  "runs" | "rect" | "lineSlots"
>) {
  return layoutQuireInlineTextFragmentsFromQuireLayout({
    id: "paragraph-0",
    rect: parts.rect,
    runs: parts.runs,
    ...(parts.lineSlots === undefined ? {} : { lineSlots: parts.lineSlots }),
    lineHeight: 24,
    textBaselineOffset: 18,
    textMeasurer: fixedMeasurer,
    lineBreakMode: "word"
  });
}

/**
 * Collects fragment text by visual line.
 *
 * @param fragments - Inline fragments emitted in visual line order.
 * @returns One joined text string per fragment line.
 */
function collectLineText(
  fragments: ReturnType<typeof layoutQuireInlineTextFragmentsFromQuireLayout>
): string[] {
  const lines: string[] = [];
  let currentY: number | undefined;

  for (const fragment of fragments) {
    if (fragment.rect.y !== currentY) {
      lines.push(fragment.text);
      currentY = fragment.rect.y;
      continue;
    }

    lines[lines.length - 1] += fragment.text;
  }

  return lines;
}

/**
 * Creates an inline run for fragment-builder tests.
 *
 * @param text - Text content owned by the run.
 * @param from - Document start position.
 * @param font - CSS font shorthand for the run.
 * @param marks - Mark names applied to the run.
 * @returns Inline run with a range derived from text length.
 */
function createRun(
  text: string,
  from: number,
  font: string,
  marks: readonly string[]
): QuireInlineTextRun {
  return {
    text,
    range: { from, to: from + text.length },
    font,
    marks
  };
}

/**
 * Shapes `fl` as one glyph cluster and leaves other characters unmerged.
 *
 * @param text - Text value to shape.
 * @returns Shaped clusters and glyphs for the supplied text.
 */
function shapeFlLigatureTextRun(text: string) {
  const clusters: QuireShapedTextCluster[] = [];
  const glyphs: QuireShapedGlyphPlacement[] = [];
  let offset = 0;
  let x = 0;

  while (offset < text.length) {
    const ligature = text.startsWith("fl", offset);
    const length = ligature ? 2 : 1;
    const advance = ligature ? 20 : 10;

    clusters.push({ from: offset, to: offset + length, x, advance, rtl: false });
    glyphs.push({
      glyphId: ligature ? 64258 : text.charCodeAt(offset),
      sourceCluster: offset,
      x,
      y: 0,
      xAdvance: advance,
      yAdvance: 0,
      xOffset: 0,
      yOffset: 0
    });
    offset += length;
    x += advance;
  }

  return {
    clusters,
    width: x,
    ascent: 0,
    descent: 0,
    glyphCoverage: "complete" as const,
    glyphs
  };
}

/**
 * Shapes `fl` as one glyph but reports partial coverage for the surrounding run.
 *
 * @param text - Text value to shape.
 * @returns Shaped clusters and glyphs for the supplied text.
 */
function shapePartialFlLigatureTextRun(text: string) {
  const full = shapeFlLigatureTextRun(text);

  return {
    ...full,
    glyphCoverage: "partial" as const,
    glyphs: full.glyphs.slice(0, 3)
  };
}

/**
 * Shapes text with narrower advances than the native fixture measurer.
 *
 * @param text - Text value to shape.
 * @returns Shaped clusters and glyphs for the supplied text.
 */
function shapeNarrowTextRun(text: string) {
  const clusters: QuireShapedTextCluster[] = [];
  const glyphs: QuireShapedGlyphPlacement[] = [];
  let offset = 0;
  let x = 0;

  for (const char of text) {
    const length = char.length;
    clusters.push({ from: offset, to: offset + length, x, advance: 7, rtl: false });
    glyphs.push({
      glyphId: char.codePointAt(0) ?? 0,
      sourceCluster: offset,
      x,
      y: 0,
      xAdvance: 7,
      yAdvance: 0,
      xOffset: 0,
      yOffset: 0
    });
    offset += length;
    x += 7;
  }

  return {
    clusters,
    width: x,
    ascent: 0,
    descent: 0,
    glyphCoverage: "complete" as const,
    glyphs
  };
}

/**
 * Measures text with a deterministic fixed-width test font.
 *
 * @param text - Text value to measure.
 * @returns Fixed-width text metrics.
 */
function measureFixedText(text: string) {
  return { width: Array.from(text).length * 10 };
}

/**
 * Measures fixed-width text and deterministic font-size vertical metrics.
 *
 * @param text - Text value to measure.
 * @param font - CSS font shorthand carrying the target pixel size.
 * @returns Fixed-width metrics with ascent/descent derived from the font size.
 */
function measureFixedTextWithFontMetrics(text: string, font: string) {
  const width = Array.from(text).length * 10;
  const size = Number.parseFloat(font) || 16;

  if (size >= 28) {
    return { width, ascent: 26, descent: 8 };
  }

  if (size <= 13) {
    return { width, ascent: 12, descent: 4 };
  }

  return { width, ascent: 18, descent: 6 };
}

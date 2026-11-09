import { appendInlinePageBreakFragments } from "./page-break-fragments";
import { layoutQuireText } from "@quirekit/renderer";
import type { QuireShapedVisualRun, QuireTextBreaker } from "@quirekit/renderer";
import type {
  QuireTextCaretStop,
  QuireTextFragment,
  QuireTextMeasurer,
  QuireTextMetrics
} from "../text";
import type { QuireLineBreakerPolicy } from "./line-breaker";
import { markQuireTextFragmentsSortedByLineTop } from "../text";
import type { QuireInlineLayoutOptions, QuireInlineTextRun } from "./types";
import { buildVisualRunFragment } from "./visual-run-fragment";
import { parseQuireFontPixelSize } from "../shaping/font-size";
import { measureInlineNaturalLineMetrics } from "./line-metrics";
import { resolveQuireInlineRunPosition } from "./run-slice";

const longNativeMetricTextThreshold = 2048;
const complexShapingPattern = /[\u0300-\u036f\u0590-\u08ff\u0900-\u0dff\u0e00-\u0e7f\u0f00-\u109f\u1100-\u11ff\u1780-\u17ff\u200d\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\ufe00-\ufefc]/u;
const cjkShapingPattern = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff]/u;
const nonCjkComplexShapingPattern = /[\u0300-\u036f\u0590-\u08ff\u0900-\u0dff\u0e00-\u0e7f\u0f00-\u109f\u1100-\u11ff\u1780-\u17ff\u200d\ufe00-\ufefc]/u;
const latinLigaturePattern = /f(?:f|i|l)/g;
const latinLigatureTestPattern = /f(?:f|i|l)/;
const inlineVerticalMetricsSampleText = "Hg";

/** Text range inside one inline run that should keep shaped glyph geometry. */
interface QuireInlineSelectiveShapeRange {
  /** Inclusive text offset where the shaped island starts. */
  readonly from: number;
  /** Exclusive text offset where the shaped island ends. */
  readonly to: number;
}

/**
 * Lays out inline runs into wrapped text fragments using the renderer's
 * multi-run text primitive.
 *
 * The renderer owns wrapping, BiDi reordering, and shaping: it wraps the styled
 * runs across run boundaries and reports, per line, the visual runs (a maximal
 * same-direction span of one source run) with run-local cluster geometry and
 * positioned glyphs. canvas-view emits one `QuireTextFragment` per visual run,
 * deriving caret stops and painted text from the cluster geometry and the
 * painter's glyphs from the run's shaped glyphs — one shaping pass, no
 * re-shaping. This keeps document-position mapping in canvas-view while the
 * renderer owns geometry; see `docs/changes/canvas-text-geometry-single-source`.
 *
 * `lineBreakMode` selects the renderer wrap mode, and a caller `lineBreaker` is
 * bridged to the renderer breaker so custom segment policies still apply; the
 * renderer's baseline policy already matches the canvas baseline (NBSP glue,
 * hyphen breaks, word/CJK handling).
 *
 * @param options - Inline runs, layout rectangle, and measurement options.
 * @returns Wrapped measured text fragments in visual line order.
 */
export function layoutQuireInlineTextFragmentsFromQuireLayout(
  options: QuireInlineLayoutOptions
): readonly QuireTextFragment[] {
  const fragmentStartIndex = options.fragmentStartIndex ?? 0;
  const traceStage = createInlineTraceStage(options);
  const measureText = createInlineMeasureText(options.textMeasurer);
  // Hidden text in normal view is excluded before every renderer-owned layout
  // phase. Keeping it out of the run stream prevents invisible source from
  // influencing BiDi, break opportunities, shaping, metrics, and pagination.
  const collapsedRuns = options.runs.filter((run) => run.hiddenText === "collapsed");
  const visibleRuns = options.runs.filter((run) => run.hiddenText !== "collapsed");
  const sourceRuns = (
    options.forceNativeMetricLayout === true ||
    options.textMeasurer.shapeRun === undefined
  )
    ? visibleRuns
    : splitInlineRunsForSelectiveShaping(visibleRuns);
  const useShaper =
    options.forceNativeMetricLayout === true
      ? false
      : shouldUseInlineShaper(sourceRuns, options.textMeasurer.shapeRun);
  const useNativeGraphemeMetricLayout =
    options.textMeasurer.shapeRun !== undefined &&
    (
      !useShaper ||
      options.forceNativeMetricLayout === true ||
      sourceRuns.some((run) => !shouldShapeInlineTextRun(
        run.text,
        run.language,
        run.direction
      ))
    );
  const layoutRuns = traceStage("layout:collect:inline:prepare-runs", () =>
    sourceRuns.map((run) => {
      if (run.replacement !== undefined) {
        const baselineOffset = run.replacement.baselineOffset;
        return {
          text: run.text,
          font: run.font,
          ...(run.characterGrid === undefined ? {} : { characterGrid: run.characterGrid }),
          ...(run.direction === undefined ? {} : { direction: run.direction }),
          ascent: baselineOffset ?? run.replacement.blockSize,
          descent: baselineOffset === undefined
            ? 0
            : Math.max(run.replacement.blockSize - baselineOffset, 0),
          replacement: { inlineSize: run.replacement.inlineSize }
        };
      }
      if (
        shouldUseShapedRunVerticalMetrics(run, useShaper)
        && run.emphasisMark === undefined
        && options.lineSpacing === undefined
      ) {
        return {
          text: run.text,
          font: run.font,
          ...(run.characterGrid === undefined ? {} : { characterGrid: run.characterGrid }),
          ...(run.direction === undefined ? {} : { direction: run.direction }),
          ...(run.baselineShift === undefined
            ? {}
            : { baselineShift: run.baselineShift }),
          ...(run.horizontalScale === undefined ? {} : { horizontalScale: run.horizontalScale }),
          ...(run.letterSpacing === undefined
            ? {}
            : { letterSpacing: run.letterSpacing })
        };
      }

      const metrics = extendInlineRunMetricsForEmphasis(
        run,
        options.lineSpacing === undefined
          ? measureInlineRunVerticalMetrics(run, measureText)
          : measureInlineNaturalLineMetrics(run, measureText)
      );
      return {
        text: run.text,
        font: run.font,
        ...(run.characterGrid === undefined ? {} : { characterGrid: run.characterGrid }),
        ...(run.direction === undefined ? {} : { direction: run.direction }),
        ...(metrics.ascent === undefined ? {} : { ascent: metrics.ascent }),
        ...(metrics.descent === undefined ? {} : { descent: metrics.descent }),
        ...(options.lineSpacing === undefined ? {} : { lineHeight: metrics.lineHeight }),
        ...(run.baselineShift === undefined
          ? {}
          : { baselineShift: run.baselineShift }),
        ...(run.horizontalScale === undefined ? {} : { horizontalScale: run.horizontalScale }),
        ...(run.letterSpacing === undefined
          ? {}
          : { letterSpacing: run.letterSpacing })
      };
    })
  );
  const layout = traceStage("layout:collect:inline:layout-text", () => layoutQuireText({
    runs: layoutRuns,
    maxWidth: options.rect.width,
    ...(options.lineSlots === undefined ? {} : { lineSlots: options.lineSlots }),
    lineHeight: options.lineHeight,
    lineSpacing: options.lineSpacing,
    ...(options.lineHeightMode === undefined
      ? {}
      : { lineHeightMode: options.lineHeightMode }),
    ...(options.lineHeightStep === undefined
      ? {}
      : { lineHeightStep: options.lineHeightStep }),
    baselineOffset: options.textBaselineOffset,
    ...(options.lineMetricContributions === undefined
      ? {}
      : { lineMetricContributions: options.lineMetricContributions }),
    ...(options.finalLineMetricContribution === undefined
      ? {}
      : { finalLineMetricContribution: options.finalLineMetricContribution }),
    wrapMode: options.lineBreakMode,
    avoidPunctuationBreaks: options.avoidPunctuationBreaks,
    autoSpacing: options.autoSpacing,
    baseDirection: options.baseDirection ?? "auto",
    alignment: options.alignment ?? "start",
    tabs: options.tabs,
    justifySoftBreaks: options.justifySoftBreaks,
    ...(options.lineBreaker === undefined
      ? {}
      : { breaker: toQuireTextBreaker(options.lineBreaker) }),
    ...(options.trace === undefined ? {} : { trace: options.trace }),
    measureText: (text, font) => ({
      width: measureText(text, font).width,
      height: 0
    }),
    ...(useNativeGraphemeMetricLayout ? { nativeAdvanceMode: "grapheme" as const } : {}),
    // Cursive scripts (Arabic) join, so per-grapheme width measurement cannot
    // produce correct advances; bridge the shaping measurer when present. The
    // renderer keeps its BiDi visual ordering and positions the glyphs per run.
    ...(!useShaper
      ? {}
      : {
          shapeText: (text, font, context) => {
            const sourceRun = sourceRuns[context.runIndex];
            const shaped = options.textMeasurer.shapeRun!(text, font, {
              ...(sourceRun?.language === undefined
                ? {}
                : { language: sourceRun.language }),
              direction: context.direction,
              ...((sourceRun?.letterSpacing === undefined || sourceRun.letterSpacing === 0)
                && sourceRun?.characterGrid?.mode !== "spacing"
                ? {}
                : { disableOptionalLigatures: true })
            });
            return {
              clusters: shaped.clusters.map((cluster) => ({
                offset: cluster.from,
                length: cluster.to - cluster.from,
                advance: cluster.advance
              })),
              glyphs: (shaped.glyphs ?? []).map((glyph) => ({
                glyphId: glyph.glyphId,
                cluster: glyph.sourceCluster,
                x: glyph.x,
                y: glyph.y,
                xAdvance: glyph.xAdvance,
                yAdvance: glyph.yAdvance,
                xOffset: glyph.xOffset,
                yOffset: glyph.yOffset,
                ...(glyph.fontId === undefined ? {} : { fontId: glyph.fontId }),
                ...(glyph.fontFamily === undefined ? {} : { fontFamily: glyph.fontFamily })
              })),
              ...(shaped.ascent === undefined ? {} : { ascent: shaped.ascent }),
              ...(shaped.descent === undefined ? {} : { descent: shaped.descent }),
              ...(shaped.glyphCoverage === undefined ? {} : { glyphCoverage: shaped.glyphCoverage })
            };
          },
          shouldShapeRun: (run, index) => shouldShapeInlineSourceRun(
            sourceRuns[index],
            run.text
          )
        })
  }));

  const fragments: QuireTextFragment[] = [];
  traceStage("layout:collect:inline:build-fragments", () => {
    const runsByLine = groupVisualRunsByLine(layout.visualRuns);

    layout.lines.forEach((line, lineIndex) => {
      const lineY = options.rect.y + line.rect.y;
      const baseline = lineY + line.baselineOffset;
      const visualRuns = runsByLine.get(lineIndex);

      if (visualRuns === undefined) {
        appendEmptyLineFragment(fragments, options, sourceRuns, line, lineY, baseline);
        return;
      }

      for (const visualRun of visualRuns) {
        const run = sourceRuns[visualRun.run];
        if (run === undefined) {
          continue;
        }
        fragments.push(buildVisualRunFragment({
          options,
          run,
          visualRun,
          lineY,
          baseline,
          lineHeight: line.rect.height,
          fragmentCount: fragmentStartIndex + fragments.length
        }));
      }
    });
  });

  appendInlinePageBreakFragments(fragments, sourceRuns, layout.lines, options);

  appendCollapsedHiddenTextFragments(
    fragments,
    collapsedRuns,
    options,
    fragmentStartIndex
  );
  fragments.sort(compareInlineFragmentsByVisualFlow);

  return markQuireTextFragmentsSortedByLineTop(fragments);
}

/**
 * Restores document-position topology for hidden runs excluded from measurement.
 *
 * Each hidden UTF-16 source position receives a caret stop at the same measured
 * boundary. The fragment paints nothing and has zero advance, so interaction
 * can traverse the source range without allowing invisible glyphs to influence
 * visible geometry.
 *
 * @param fragments - Visible fragments produced by renderer layout.
 * @param collapsedRuns - Hidden source runs removed before renderer layout.
 * @param options - Inline geometry and line metrics.
 * @param fragmentStartIndex - Stable id offset for this layout request.
 * @returns Nothing.
 */
function appendCollapsedHiddenTextFragments(
  fragments: QuireTextFragment[],
  collapsedRuns: readonly QuireInlineTextRun[],
  options: QuireInlineLayoutOptions,
  fragmentStartIndex: number
): void {
  if (collapsedRuns.length === 0) {
    return;
  }

  const visibleFragments = [...fragments];
  for (const run of collapsedRuns) {
    const anchor = resolveCollapsedHiddenTextAnchor(
      run,
      visibleFragments,
      options
    );
    const caretStops: QuireTextCaretStop[] = [];
    for (let position = run.range.from; position <= run.range.to; position += 1) {
      caretStops.push({
        position: {
          pos: position,
          bias: position === run.range.from
            ? 1
            : position === run.range.to
              ? -1
              : 0
        },
        localX: 0
      });
    }
    fragments.push({
      id: `${options.id}:text-${fragmentStartIndex + fragments.length}`,
      text: "",
      range: run.range,
      rect: {
        x: anchor.x,
        y: anchor.y,
        width: 0,
        height: anchor.lineHeight
      },
      font: run.font,
      hiddenText: "collapsed",
      ...(run.marks.length === 0 ? {} : { marks: run.marks }),
      lineHeight: anchor.lineHeight,
      baseline: anchor.baseline,
      caretStops
    });
  }
}

/** Geometry used to anchor one zero-advance hidden source fragment. */
interface CollapsedHiddenTextAnchor {
  /** Absolute boundary x coordinate. */
  readonly x: number;
  /** Absolute line-top coordinate. */
  readonly y: number;
  /** Line box height inherited from visible or empty-paragraph geometry. */
  readonly lineHeight: number;
  /** Absolute baseline inherited from the owning line. */
  readonly baseline: number;
}

/**
 * Finds the visible boundary that owns one excluded hidden range.
 *
 * A preceding source boundary wins, matching ordinary insertion affinity. A
 * paragraph-leading hidden range falls back to the following visible boundary;
 * an all-hidden paragraph uses the logical start edge of the ordinary empty
 * line box.
 *
 * @param run - Hidden source run being anchored.
 * @param visibleFragments - Renderer-produced visible fragments.
 * @param options - Inline geometry and paragraph direction.
 * @returns Zero-advance anchor geometry.
 */
function resolveCollapsedHiddenTextAnchor(
  run: QuireInlineTextRun,
  visibleFragments: readonly QuireTextFragment[],
  options: QuireInlineLayoutOptions
): CollapsedHiddenTextAnchor {
  const preceding = [...visibleFragments]
    .filter((fragment) => fragment.range.to <= run.range.from)
    .sort((first, second) => second.range.to - first.range.to)
    .at(0);
  if (preceding !== undefined) {
    const stop = preceding.caretStops.find(
      (candidate) => candidate.position.pos === preceding.range.to
    ) ?? preceding.caretStops.at(-1);
    return {
      x: preceding.rect.x + (stop?.localX ?? preceding.rect.width),
      y: preceding.rect.y,
      lineHeight: preceding.lineHeight,
      baseline: preceding.baseline
    };
  }

  const following = [...visibleFragments]
    .filter((fragment) => fragment.range.from >= run.range.to)
    .sort((first, second) => first.range.from - second.range.from)
    .at(0);
  if (following !== undefined) {
    const stop = following.caretStops.find(
      (candidate) => candidate.position.pos === following.range.from
    ) ?? following.caretStops[0];
    return {
      x: following.rect.x + (stop?.localX ?? 0),
      y: following.rect.y,
      lineHeight: following.lineHeight,
      baseline: following.baseline
    };
  }

  return {
    x: options.baseDirection === "rtl"
      ? options.rect.x + options.rect.width
      : options.rect.x,
    y: options.rect.y,
    lineHeight: options.lineHeight,
    baseline: options.rect.y + options.textBaselineOffset
  };
}

/**
 * Orders visible and zero-advance fragments by line, then physical inline edge.
 *
 * @param first - First fragment.
 * @param second - Second fragment.
 * @returns Negative, zero, or positive sort order.
 */
function compareInlineFragmentsByVisualFlow(
  first: QuireTextFragment,
  second: QuireTextFragment
): number {
  return first.rect.y - second.rect.y
    || first.rect.x - second.rect.x
    || first.range.from - second.range.from;
}

/**
 * Splits ordinary Latin and CJK-mixed runs so only shaped islands pay glyph
 * layout.
 *
 * Non-CJK complex scripts keep their original run because their shaping, font
 * fallback, marks, or joining behavior may depend on a wider contiguous segment.
 * CJK runs can be isolated safely from Latin neighbors, so an English paragraph
 * with a Chinese suffix does not switch the whole Latin prefix onto shaper
 * metrics. Plain Latin runs with `ff`/`fi`/`fl` are still split around those
 * small islands so the rest can use native metrics.
 *
 * @param runs - Inline runs collected from the source textblock.
 * @returns Runs to feed to the renderer layout primitive.
 */
function splitInlineRunsForSelectiveShaping(
  runs: readonly QuireInlineTextRun[]
): readonly QuireInlineTextRun[] {
  const output: QuireInlineTextRun[] = [];

  for (const run of runs) {
    appendSelectiveShapeRun(output, run);
  }

  return output;
}

/**
 * Appends one run, splitting Latin ligature and CJK shaping islands when safe.
 *
 * @param output - Mutable output run list.
 * @param run - Source run to append or split.
 */
function appendSelectiveShapeRun(
  output: QuireInlineTextRun[],
  run: QuireInlineTextRun
): void {
  if (run.replacement !== undefined) {
    output.push(run);
    return;
  }
  if (run.language !== undefined) {
    output.push(run);
    return;
  }
  if (run.letterSpacing !== undefined && run.letterSpacing !== 0) {
    output.push(run);
    return;
  }
  if (run.text.length === 0 || containsNonCjkComplexShapingText(run.text)) {
    output.push(run);
    return;
  }

  if (containsCjkShapingText(run.text)) {
    appendCjkSelectiveShapeRun(output, run);
    return;
  }

  appendNativeSelectiveShapeRunSlice(output, run, 0, run.text.length);
}

/**
 * Appends a run that contains only Latin/native text plus CJK shaping islands.
 *
 * @param output - Mutable output run list.
 * @param run - Source run to split.
 */
function appendCjkSelectiveShapeRun(
  output: QuireInlineTextRun[],
  run: QuireInlineTextRun
): void {
  let nativeStart = 0;
  let cjkStart: number | undefined;

  for (let offset = 0; offset < run.text.length;) {
    const codePoint = run.text.codePointAt(offset);
    if (codePoint === undefined) {
      break;
    }

    const codeUnitLength = codePoint > 0xffff ? 2 : 1;
    if (isCjkShapingCodePoint(codePoint)) {
      if (cjkStart === undefined) {
        appendNativeSelectiveShapeRunSlice(output, run, nativeStart, offset);
        cjkStart = offset;
      }
    } else if (cjkStart !== undefined) {
      appendRunSlice(output, run, cjkStart, offset);
      cjkStart = undefined;
      nativeStart = offset;
    }

    offset += codeUnitLength;
  }

  if (cjkStart === undefined) {
    appendNativeSelectiveShapeRunSlice(output, run, nativeStart, run.text.length);
    return;
  }

  appendRunSlice(output, run, cjkStart, run.text.length);
}

/**
 * Appends a native-measured text slice, preserving small Latin ligature islands.
 *
 * @param output - Mutable output run list.
 * @param run - Source run to slice.
 * @param from - Inclusive text offset in the source run.
 * @param to - Exclusive text offset in the source run.
 */
function appendNativeSelectiveShapeRunSlice(
  output: QuireInlineTextRun[],
  run: QuireInlineTextRun,
  from: number,
  to: number
): void {
  if (to <= from) {
    return;
  }

  if (to - from > longNativeMetricTextThreshold) {
    appendRunSlice(output, run, from, to);
    return;
  }

  const text = run.text.slice(from, to);
  const ranges = findLatinLigatureRanges(text);
  if (ranges.length === 0) {
    appendRunSlice(output, run, from, to);
    return;
  }

  let cursor = from;
  for (const range of ranges) {
    appendRunSlice(output, run, cursor, from + range.from);
    appendRunSlice(output, run, from + range.from, from + range.to);
    cursor = from + range.to;
  }
  appendRunSlice(output, run, cursor, to);
}

/**
 * Appends a source-run text slice with an adjusted document range.
 *
 * @param output - Mutable output run list.
 * @param run - Source run to slice.
 * @param from - Inclusive text offset in the source run.
 * @param to - Exclusive text offset in the source run.
 */
function appendRunSlice(
  output: QuireInlineTextRun[],
  run: QuireInlineTextRun,
  from: number,
  to: number
): void {
  if (to <= from) {
    return;
  }

  output.push({
    ...run,
    text: run.text.slice(from, to),
    range: {
      from: resolveQuireInlineRunPosition(run, from),
      to: resolveQuireInlineRunPosition(run, to)
    }
  });
}

/**
 * Finds common Latin ligature candidate ranges inside a simple run.
 *
 * @param text - Text run to inspect.
 * @returns Candidate ranges in source order.
 */
function findLatinLigatureRanges(
  text: string
): readonly QuireInlineSelectiveShapeRange[] {
  const ranges: QuireInlineSelectiveShapeRange[] = [];
  latinLigaturePattern.lastIndex = 0;

  for (let match = latinLigaturePattern.exec(text); match !== null;) {
    const value = match[0] ?? "";
    if (value.length === 0) {
      latinLigaturePattern.lastIndex += 1;
    } else {
      ranges.push({ from: match.index, to: match.index + value.length });
    }
    match = latinLigaturePattern.exec(text);
  }

  return ranges;
}

/**
 * Checks whether a run should let the shaping backend provide vertical metrics.
 *
 * @param run - Inline run being converted for renderer layout.
 * @param useShaper - Whether this layout pass enabled the shaping callback.
 * @returns Whether the run should avoid a separate native metrics read.
 */
function shouldUseShapedRunVerticalMetrics(
  run: QuireInlineTextRun,
  useShaper: boolean
): boolean {
  return useShaper
    && (run.letterSpacing === undefined || run.letterSpacing === 0)
    && shouldShapeInlineTextRun(run.text, run.language, run.direction);
}

/**
 * Measures font-wide vertical metrics without measuring a potentially huge run.
 *
 * The browser canvas API exposes font bounding metrics on any `measureText`
 * call. Sampling a short ascender/descender string keeps the long-paragraph hot
 * path cheap while still giving the renderer enough ascent/descent data to grow
 * mixed-size line boxes for native-metric runs.
 *
 * @param run - Inline run whose font should provide vertical metrics.
 * @param measureText - Memoized inline text measurer.
 * @returns Font metrics for the run's font, when the measurer can provide them.
 */
function measureInlineRunVerticalMetrics(
  run: QuireInlineTextRun,
  measureText: QuireTextMeasurer["measureText"]
): QuireTextMetrics {
  return measureText(inlineVerticalMetricsSampleText, run.font);
}

/**
 * Extends minimum line metrics for one visible emphasis mark.
 *
 * Horizontal geometry remains untouched. The renderer ignores these values in
 * exact-line-height mode, matching Word's fixed-line-spacing behavior.
 *
 * @param run - Inline run carrying an optional emphasis mark.
 * @param metrics - Font metrics measured before emphasis extent is included.
 * @returns Metrics including over- or under-side marker space.
 */
function extendInlineRunMetricsForEmphasis(
  run: QuireInlineTextRun,
  metrics: QuireTextMetrics
): QuireTextMetrics {
  if (run.emphasisMark === undefined) return metrics;
  const fontSize = parseQuireFontPixelSize(run.font) ?? 16;
  const ascent = metrics.ascent ?? fontSize * 0.8;
  const descent = metrics.descent ?? fontSize * 0.2;
  const markerExtent = Math.max(3, fontSize * 0.22);
  return {
    ...metrics,
    ascent: run.emphasisMark === "underDot"
      ? ascent
      : ascent + markerExtent,
    descent: run.emphasisMark === "underDot"
      ? descent + markerExtent
      : descent
  };
}

/**
 * Creates a per-layout text measurement memo.
 *
 * A tail-reuse convergence window repeatedly measures the same words, spaces,
 * and graphemes while wrapping and building caret geometry. Keeping the memo
 * scoped to one inline layout pass avoids stale font metrics while removing
 * duplicate browser/fallback/shaper-backed width reads inside the hot path.
 *
 * @param measurer - Underlying text measurer.
 * @returns Memoized measure function for this inline layout pass.
 */
function createInlineMeasureText(
  measurer: QuireTextMeasurer
): QuireTextMeasurer["measureText"] {
  const cache = new Map<string, QuireTextMetrics>();

  return (text, font) => {
    const key = `${font}\u0000${text}`;
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const measured = measurer.measureText(text, font);
    cache.set(key, measured);
    return measured;
  };
}

/**
 * Chooses whether inline layout should shape full runs up front.
 *
 * Plain Latin text is the repeat-input hotspot: shaping ordinary editable
 * Latin on every transaction costs much more than native metric reads, while
 * canvas/SVG can still paint native text correctly. Complex scripts and common
 * Latin ligature candidates keep the shaper path so glyph clusters, caret stops,
 * and selection rectangles stay continuous where native prefix metrics are not
 * enough.
 *
 * @param runs - Inline runs being laid out.
 * @param shapeRun - Optional text shaper supplied by the measurer.
 * @returns Whether the renderer should receive a shaper for this layout pass.
 */
function shouldUseInlineShaper(
  runs: readonly QuireInlineTextRun[],
  shapeRun: QuireInlineLayoutOptions["textMeasurer"]["shapeRun"]
): boolean {
  if (shapeRun === undefined) {
    return false;
  }

  for (const run of runs) {
    if (shouldShapeInlineTextRun(run.text, run.language, run.direction)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether one renderer source run needs shaped glyph geometry.
 *
 * @param text - Source run text.
 * @param language - Optional explicit run language requiring semantic shaping.
 * @param direction - Optional explicit run direction requiring semantic shaping.
 * @returns Whether this run should invoke the shaper.
 */
function shouldShapeInlineTextRun(
  text: string,
  language?: string,
  direction?: "rtl"
): boolean {
  return (
    language !== undefined ||
    direction === "rtl" ||
    containsComplexShapingText(text) ||
    (
      text.length <= longNativeMetricTextThreshold &&
      containsLatinLigatureCandidate(text)
    )
  );
}

/**
 * Decides whether one complete source run should override native tracking.
 *
 * @param sourceRun - Canonical inline run carrying language and tracking.
 * @param fallbackText - Renderer run text used when the source run is absent.
 * @returns Whether the run needs language-aware or complex-script shaping.
 */
function shouldShapeInlineSourceRun(
  sourceRun: QuireInlineTextRun | undefined,
  fallbackText: string
): boolean {
  const text = sourceRun?.text ?? fallbackText;
  if (
    sourceRun?.letterSpacing !== undefined
    && sourceRun.letterSpacing !== 0
  ) {
    return sourceRun.language !== undefined
      || sourceRun.direction === "rtl"
      || containsNonCjkComplexShapingText(text);
  }
  return shouldShapeInlineTextRun(text, sourceRun?.language, sourceRun?.direction);
}

/**
 * Checks for scripts and controls where native prefix metrics are not enough.
 *
 * @param text - Text run to inspect.
 * @returns Whether the run should keep exact shaping despite its length.
 */
function containsComplexShapingText(text: string): boolean {
  return complexShapingPattern.test(text);
}

/**
 * Checks for complex shaping text outside the CJK ranges that are safe to
 * isolate from Latin neighbors.
 *
 * @param text - Text run to inspect.
 * @returns Whether the run should stay contiguous for conservative shaping.
 */
function containsNonCjkComplexShapingText(text: string): boolean {
  return nonCjkComplexShapingPattern.test(text);
}

/**
 * Checks for CJK-range text that should shape as its own island.
 *
 * @param text - Text run to inspect.
 * @returns Whether the run contains CJK text.
 */
function containsCjkShapingText(text: string): boolean {
  return cjkShapingPattern.test(text);
}

/**
 * Checks whether one Unicode code point belongs to the CJK shaping island set.
 *
 * @param codePoint - Unicode code point to classify.
 * @returns Whether the code point should be isolated as CJK shaping text.
 */
function isCjkShapingCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x2e80 && codePoint <= 0x9fff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff)
  );
}

/**
 * Checks for common Latin ligature sequences that need shaped cluster mapping.
 *
 * Plain Latin can use native canvas/SVG text metrics, but `fi`/`fl`/`ff`
 * families can collapse multiple codepoints into one glyph. Keeping these runs
 * on the shaper path prevents zero-width component gaps in wrapping, caret, and
 * selection geometry while allowing ordinary Latin input to stay cheap.
 *
 * @param text - Text run to inspect.
 * @returns Whether the run contains a common Latin ligature candidate.
 */
function containsLatinLigatureCandidate(text: string): boolean {
  return latinLigatureTestPattern.test(text);
}

/**
 * Creates a small trace helper for inline layout diagnostics.
 *
 * @param options - Inline layout options that may carry a trace sink.
 * @returns Function that measures a named inline stage.
 */
function createInlineTraceStage(
  options: QuireInlineLayoutOptions
): <Result>(name: string, run: () => Result) => Result {
  return <Result>(name: string, run: () => Result): Result => {
    if (options.trace === undefined) {
      return run();
    }
    const startedAt = globalThis.performance?.now() ?? Date.now();
    try {
      return run();
    } finally {
      const endedAt = globalThis.performance?.now() ?? Date.now();
      options.trace?.({ name, startedAt, endedAt, durationMs: endedAt - startedAt });
    }
  };
}

/**
 * Groups the layout's flat visual runs by their line index.
 *
 * @param visualRuns - Visual runs in visual order across all lines.
 * @returns Map of line index to its visual runs, preserving left-to-right order.
 */
function groupVisualRunsByLine(
  visualRuns: readonly QuireShapedVisualRun[]
): ReadonlyMap<number, QuireShapedVisualRun[]> {
  const byLine = new Map<number, QuireShapedVisualRun[]>();
  for (const visualRun of visualRuns) {
    const runs = byLine.get(visualRun.line) ?? [];
    runs.push(visualRun);
    byLine.set(visualRun.line, runs);
  }
  return byLine;
}

/**
 * Appends a zero-width caret-anchor fragment for an empty wrapped line.
 *
 * Empty lines come from empty paragraphs (no runs, in which case nothing is
 * appended) and from trailing hard breaks. The fragment carries a single caret
 * stop at the line's start anchor so a caret can sit on the blank line.
 *
 * @param fragments - Fragment list being assembled.
 * @param options - Inline layout options providing the rect origin.
 * @param runs - Source runs used for renderer layout.
 * @param line - The empty wrapped line whose start anchor is used.
 * @param lineY - Absolute y of the line's top edge.
 * @param baseline - Absolute baseline y for the line.
 */
function appendEmptyLineFragment(
  fragments: QuireTextFragment[],
  options: QuireInlineLayoutOptions,
  runs: readonly QuireInlineTextRun[],
  line: ReturnType<typeof layoutQuireText>["lines"][number],
  lineY: number,
  baseline: number
): void {
  const run = runs[line.start.run];
  if (!run) {
    return;
  }

  const position = resolveQuireInlineRunPosition(run, line.start.offset);
  const fragment = {
    id: `${options.id}:text-${(options.fragmentStartIndex ?? 0) + fragments.length}`,
    text: "",
    range: { from: position, to: position },
    rect: { x: options.rect.x, y: lineY, width: 0, height: line.rect.height },
    font: run.font,
    lineHeight: line.rect.height,
    baseline,
    caretStops: [{ position: { pos: position, bias: 1 }, localX: 0 }]
  } satisfies QuireTextFragment;

  fragments.push(
    run.marks.length === 0 ? fragment : { ...fragment, marks: run.marks }
  );
}

/**
 * Adapts a canvas line-breaker policy to the renderer breaker contract.
 *
 * The two share the same segment kinds and metadata shape, so the canvas
 * `describeSegment`/`mergeMetadata` map directly onto the renderer breaker; the
 * renderer folds hard-break detection into `describe`, so `isHardBreakSegment`
 * is not needed.
 *
 * @param policy - Canvas line-breaker policy supplied by the host.
 * @returns Equivalent renderer breaker.
 */
function toQuireTextBreaker(policy: QuireLineBreakerPolicy): QuireTextBreaker {
  return {
    name: policy.name,
    describe: policy.describeSegment,
    merge: policy.mergeMetadata
  };
}

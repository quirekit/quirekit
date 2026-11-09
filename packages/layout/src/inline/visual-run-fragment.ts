import type { QuireShapedVisualRun } from "@quirekit/renderer";
import { buildQuireTextFragment } from "../text";
import type {
  QuireShapedGlyphPlacement,
  QuireShapedTextCluster,
  QuireShapedTextRun,
  QuireTextFragment
} from "../text";
import type { QuireInlineLayoutOptions, QuireInlineTextRun } from "./types";
import { buildVisualRunCaretStops } from "./visual-run-caret";
import { resolveQuireInlineRunPosition } from "./run-slice";

/**
 * Builds a measured fragment for one visual run.
 *
 * The run's clusters are visual-order and run-local (origin at the run's left
 * edge), so the fragment is anchored at that edge, its caret stops come straight
 * from the cluster geometry, and its glyphs are the run's shaped glyphs — no
 * re-shaping. See `docs/changes/canvas-text-geometry-single-source`.
 *
 * @param input - Run, its visual run, geometry, and id counter.
 * @returns The measured visual-run fragment.
 */
export function buildVisualRunFragment(input: {
  readonly options: QuireInlineLayoutOptions;
  readonly run: QuireInlineTextRun;
  readonly visualRun: QuireShapedVisualRun;
  readonly lineY: number;
  readonly baseline: number;
  readonly lineHeight: number;
  readonly fragmentCount: number;
}): QuireTextFragment {
  const { options, run, visualRun } = input;
  const rtl = visualRun.direction === "rtl";
  let fromOffset = Number.POSITIVE_INFINITY;
  let toOffset = 0;
  for (const cluster of visualRun.clusters) {
    fromOffset = Math.min(fromOffset, cluster.from);
    toOffset = Math.max(toOffset, cluster.to);
  }

  // Clamp to the run's document range: generated visual runs may carry text
  // longer than their represented document range.
  const from = resolveQuireInlineRunPosition(run, fromOffset);
  const to = resolveQuireInlineRunPosition(run, toOffset);
  const caretStops = buildVisualRunCaretStops(visualRun, rtl, run, from, to);
  const shapedRun = buildVisualRunShapedRun(visualRun, run, fromOffset, rtl);
  const baselineShift = run.baselineShift ?? 0;

  return buildQuireTextFragment({
    id: `${options.id}:text-${input.fragmentCount}`,
    text: visualRun.tab === undefined ? buildVisualRunText(visualRun, run) : "\t",
    tab: visualRun.tab,
    range: { from, to },
    rect: {
      x: options.rect.x + visualRun.x,
      y: input.lineY,
      width: 0,
      height: input.lineHeight
    },
    font: run.font,
    trailingSpacing: visualRun.trailingSpacing,
    paintOffset: visualRun.paintOffset,
    ...(run.horizontalScale === undefined || visualRun.tab !== undefined ? {} : { horizontalScale: run.horizontalScale }),
    ...(run.language === undefined ? {} : { language: run.language }),
    ...(run.letterSpacing === undefined || visualRun.tab !== undefined
      ? {}
      : { letterSpacing: run.letterSpacing }),
    ...(run.color === undefined ? {} : { textColor: run.color }),
    ...(run.backgroundColor === undefined
      ? {}
      : { textBackgroundColor: run.backgroundColor }),
    ...(run.textDecoration === undefined ? {} : { textDecoration: run.textDecoration }),
    ...(run.underline === undefined ? {} : { underline: run.underline }),
    ...(run.emphasisMark === undefined ? {} : { emphasisMark: run.emphasisMark }),
    ...(run.glyphEffects === undefined ? {} : { glyphEffects: run.glyphEffects }),
    ...(run.hiddenText === undefined ? {} : { hiddenText: run.hiddenText }),
    ...(run.marks.length === 0 ? {} : { marks: run.marks }),
    lineHeight: input.lineHeight,
    ...(options.lineSpacing?.mode === "exact" ? { clipToLine: true } : {}),
    baseline: input.baseline - baselineShift,
    ...(visualRun.ascent === undefined ? {} : { runAscent: visualRun.ascent }),
    ...(visualRun.descent === undefined ? {} : { runDescent: visualRun.descent }),
    ...(rtl ? { direction: "rtl" as const } : {}),
    caretStops,
    ...(shapedRun === undefined ? {} : { shapedRun }),
    measurer: options.textMeasurer
  });
}

/**
 * Builds the painted text for a visual run in logical order.
 *
 * Collapsed whitespace has zero advance and is dropped, so the painted string
 * matches the collapsed layout while the caret stops still cover every position.
 *
 * @param visualRun - Visual run whose clusters carry the source offsets.
 * @param run - Source run owning the text.
 * @returns Painted text in logical order.
 */
function buildVisualRunText(
  visualRun: QuireShapedVisualRun,
  run: QuireInlineTextRun
): string {
  if (run.replacement !== undefined) {
    return "";
  }
  const clusters = areVisualRunClustersInLogicalOrder(visualRun.clusters)
    ? visualRun.clusters
    : [...visualRun.clusters].sort((first, second) => first.from - second.from);
  let text = "";

  for (const cluster of clusters) {
    const clusterText = run.text.slice(cluster.from, cluster.to);
    // Drop only collapsed whitespace (zero advance); keep every other glyph.
    if (cluster.advance === 0 && isWhitespaceText(clusterText)) {
      continue;
    }
    text += clusterText;
  }

  return text;
}

/**
 * Checks whether clusters are already in source/logical order.
 *
 * LTR native text, the long-paragraph hot path, arrives in this order. Avoiding
 * per-line array copies and sorts keeps fragment building proportional to the
 * actual cluster count instead of allocation-heavy utility chains.
 *
 * @param clusters - Visual-run clusters to inspect.
 * @returns Whether the clusters are monotonically ordered by source offset.
 */
function areVisualRunClustersInLogicalOrder(
  clusters: QuireShapedVisualRun["clusters"]
): boolean {
  let previous = -Infinity;

  for (const cluster of clusters) {
    if (cluster.from < previous) {
      return false;
    }
    previous = cluster.from;
  }

  return true;
}

/**
 * Checks whether text consists only of whitespace.
 *
 * @param text - Text slice to inspect.
 * @returns Whether the text is non-empty whitespace.
 */
function isWhitespaceText(text: string): boolean {
  return /^\s+$/u.test(text);
}

/**
 * Builds a canvas shaped run from the visual run's positioned glyphs.
 *
 * The glyphs come from the single layout shaping pass, run-local and rebased to
 * fragment-relative source clusters; collapsed-whitespace glyphs are dropped to
 * match the painted text. The shaped run preserves the visual run's own metrics
 * so paint and interaction geometry share the same vertical authority.
 *
 * @param visualRun - Visual run carrying the shaped glyphs and clusters.
 * @param run - Source run owning the text (for whitespace detection).
 * @param fromOffset - Lowest source offset in the run, for fragment-relative clusters.
 * @param rtl - Whether the run reads right-to-left.
 * @returns The shaped run, or undefined when there are no paintable glyphs.
 */
function buildVisualRunShapedRun(
  visualRun: QuireShapedVisualRun,
  run: QuireInlineTextRun,
  fromOffset: number,
  rtl: boolean
): QuireShapedTextRun | undefined {
  if (
    visualRun.glyphs.length === 0
    || (run.characterGrid === undefined && run.letterSpacing !== undefined && run.letterSpacing !== 0)
  ) {
    return undefined;
  }

  const dropped = collapsedWhitespaceOffsets(visualRun, run);
  const glyphs: QuireShapedGlyphPlacement[] = visualRun.glyphs
    .filter((glyph) => !dropped.has(glyph.cluster))
    .map((glyph) => ({
      glyphId: glyph.glyphId,
      sourceCluster: glyph.cluster - fromOffset,
      x: glyph.x,
      y: glyph.y,
      xAdvance: glyph.xAdvance,
      yAdvance: glyph.yAdvance,
      xOffset: glyph.xOffset,
      yOffset: glyph.yOffset,
      ...(glyph.fontId === undefined ? {} : { fontId: glyph.fontId }),
      ...(glyph.fontFamily === undefined ? {} : { fontFamily: glyph.fontFamily })
    }));

  if (glyphs.length === 0) {
    return undefined;
  }

  const clusters: QuireShapedTextCluster[] = visualRun.clusters.map((cluster) => ({
    from: cluster.from - fromOffset,
    to: cluster.to - fromOffset,
    x: cluster.x,
    advance: cluster.advance,
    rtl
  }));
  const width = visualRun.clusters.reduce(
    (max, cluster) => Math.max(max, cluster.x + cluster.advance),
    0
  );

  return {
    clusters,
    width,
    ascent: visualRun.ascent ?? 0,
    descent: visualRun.descent ?? 0,
    glyphs,
    ...(visualRun.glyphCoverage === undefined ? {} : { glyphCoverage: visualRun.glyphCoverage })
  };
}

/**
 * Collects the source offsets covered by collapsed-whitespace clusters.
 *
 * @param visualRun - Visual run whose clusters are inspected.
 * @param run - Source run owning the text.
 * @returns Set of source offsets to drop from the painted glyphs.
 */
function collapsedWhitespaceOffsets(
  visualRun: QuireShapedVisualRun,
  run: QuireInlineTextRun
): ReadonlySet<number> {
  const dropped = new Set<number>();
  for (const cluster of visualRun.clusters) {
    const text = run.text.slice(cluster.from, cluster.to);
    if (cluster.advance === 0 && /^\s+$/u.test(text)) {
      for (let offset = cluster.from; offset < cluster.to; offset += 1) {
        dropped.add(offset);
      }
    }
  }
  return dropped;
}

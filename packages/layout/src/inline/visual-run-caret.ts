import type { QuireShapedVisualRun } from "@quirekit/renderer";
import type { QuireTextCaretStop } from "../text";
import type { QuireInlineTextRun } from "./types";
import { resolveQuireInlineRunPosition } from "./run-slice";

/**
 * Builds a fragment's caret stops from the visual run's cluster geometry.
 *
 * Clusters are walked in logical order and grouped: a base cluster plus the
 * `ligatureComponent` clusters absorbed into its glyph. Each group emits one stop
 * per component boundary, interpolated across the ligature's advance — so a caret
 * between the lam and alef of Arabic لا sits at the ligature midpoint instead of
 * snapping to an edge. A plain (single-cluster) group reduces to leading/trailing
 * edges, so non-ligature text is unchanged. Right-to-left groups place the
 * logical-leading boundary on the right. Stops are keyed by document position and
 * ordered by visual x. See `docs/changes/canvas-text-geometry-single-source`.
 *
 * @param visualRun - Visual run whose clusters are run-local in visual order.
 * @param rtl - Whether the run reads right-to-left.
 * @param run - Source run owning the document range.
 * @param rangeFrom - Fragment document range start (for caret bias).
 * @param rangeTo - Fragment document range end (for caret bias).
 * @returns Caret stops ordered by ascending local x.
 */
export function buildVisualRunCaretStops(
  visualRun: QuireShapedVisualRun,
  rtl: boolean,
  run: QuireInlineTextRun,
  rangeFrom: number,
  rangeTo: number
): readonly QuireTextCaretStop[] {
  const simpleStops = tryBuildSimpleLtrVisualRunCaretStops(
    visualRun,
    rtl,
    run,
    rangeFrom,
    rangeTo
  );
  if (simpleStops !== undefined) {
    return simpleStops;
  }

  const ligatureComponents = new Set(
    visualRun.codepoints
      .filter((codepoint) => codepoint.role === "ligatureComponent")
      .map((codepoint) => codepoint.offset)
  );
  const logical = [...visualRun.clusters].sort((first, second) => first.from - second.from);
  const localXByPosition = new Map<number, number>();
  const setStop = (offset: number, localX: number): void => {
    localXByPosition.set(resolveQuireInlineRunPosition(run, offset), localX);
  };

  let index = 0;
  while (index < logical.length) {
    const base = logical[index]!;
    let end = index + 1;
    while (end < logical.length && ligatureComponents.has(logical[end]!.from)) {
      end += 1;
    }
    const group = logical.slice(index, end);
    const count = group.length;
    const width = group.reduce((sum, cluster) => sum + cluster.advance, 0);

    for (let boundary = 0; boundary <= count; boundary += 1) {
      const offset = boundary < count ? group[boundary]!.from : group[count - 1]!.to;
      const fraction = rtl ? (count - boundary) / count : boundary / count;
      setStop(offset, base.x + width * fraction);
    }
    index = end;
  }

  return [...localXByPosition.entries()]
    .sort((first, second) => first[1] - second[1])
    .map(([pos, localX]) => ({
      position: { pos, bias: pos === rangeFrom ? 1 : pos >= rangeTo ? -1 : 0 },
      localX
    }));
}

/**
 * Builds caret stops for the common simple LTR visual run without maps or sorts.
 *
 * @param visualRun - Visual run whose clusters are run-local in visual order.
 * @param rtl - Whether the run reads right-to-left.
 * @param run - Source run owning the document range.
 * @param rangeFrom - Fragment document range start.
 * @param rangeTo - Fragment document range end.
 * @returns Caret stops, or undefined when the compatibility path is required.
 */
function tryBuildSimpleLtrVisualRunCaretStops(
  visualRun: QuireShapedVisualRun,
  rtl: boolean,
  run: QuireInlineTextRun,
  rangeFrom: number,
  rangeTo: number
): readonly QuireTextCaretStop[] | undefined {
  if (
    rtl ||
    visualRun.clusters.length === 0 ||
    hasLigatureComponentCodepoints(visualRun) ||
    !areSimpleLtrCaretClusters(visualRun, run)
  ) {
    return undefined;
  }

  const stops: QuireTextCaretStop[] = new Array(visualRun.clusters.length + 1);
  const firstCluster = visualRun.clusters[0]!;
  stops[0] = createVisualRunCaretStop(
    resolveQuireInlineRunPosition(run, firstCluster.from),
    firstCluster.x,
    rangeFrom,
    rangeTo
  );

  for (let index = 0; index < visualRun.clusters.length; index += 1) {
    const cluster = visualRun.clusters[index]!;
    stops[index + 1] = createVisualRunCaretStop(
      resolveQuireInlineRunPosition(run, cluster.to),
      cluster.x + cluster.advance,
      rangeFrom,
      rangeTo
    );
  }

  return stops;
}

/**
 * Checks whether a visual run has ligature components that need compatibility interpolation.
 *
 * @param visualRun - Visual run to inspect.
 * @returns Whether the run carries ligature component codepoints.
 */
function hasLigatureComponentCodepoints(
  visualRun: QuireShapedVisualRun
): boolean {
  for (let index = 0; index < visualRun.codepoints.length; index += 1) {
    if (visualRun.codepoints[index]?.role === "ligatureComponent") {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether clusters can be converted to caret stops by a direct LTR scan.
 *
 * @param visualRun - Visual run to inspect.
 * @param run - Source run that owns the document range.
 * @returns Whether the clusters are contiguous, ordered, and unclamped.
 */
function areSimpleLtrCaretClusters(
  visualRun: QuireShapedVisualRun,
  run: QuireInlineTextRun
): boolean {
  let previousTo: number | undefined;
  let previousRight = -Infinity;

  for (let index = 0; index < visualRun.clusters.length; index += 1) {
    const cluster = visualRun.clusters[index]!;
    if (
      !Number.isFinite(cluster.x) ||
      !Number.isFinite(cluster.advance) ||
      cluster.advance < 0 ||
      cluster.x < previousRight ||
      run.range.from + cluster.to > run.range.to ||
      (previousTo !== undefined && cluster.from !== previousTo)
    ) {
      return false;
    }

    previousTo = cluster.to;
    previousRight = cluster.x + cluster.advance;
  }

  return true;
}

/**
 * Creates one caret stop with the same bias policy as the compatibility path.
 *
 * @param pos - Document position represented by the stop.
 * @param localX - Horizontal offset relative to the fragment.
 * @param rangeFrom - Fragment document range start.
 * @param rangeTo - Fragment document range end.
 * @returns Caret stop for the position and x offset.
 */
function createVisualRunCaretStop(
  pos: number,
  localX: number,
  rangeFrom: number,
  rangeTo: number
): QuireTextCaretStop {
  return {
    position: { pos, bias: pos === rangeFrom ? 1 : pos >= rangeTo ? -1 : 0 },
    localX
  };
}

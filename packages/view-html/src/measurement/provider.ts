import { HtmlDomMappingGapError } from "../document";
import { createHtmlMeasurementCacheKey, HtmlMeasurementCache } from "./cache";
import { measureHtmlTextSelectionRects } from "./selection/measure";
import { resolveHtmlBoundaryRect, resolveHtmlCollapsedPositionFallback } from "./caret";
import {
  resolveHtmlMeasuredDomPoint,
  resolveHtmlMeasuredPosition
} from "./dom-point";
import { createHtmlBlockHitGeometry, resolveHtmlPositionAtClientPoint } from "./hit";
import { measureHtmlDomRange } from "./range";
import { measureHtmlAdjacentInlineEdge } from "./inline-boundary";
import type {
  CreateHtmlDomMeasurementProviderOptions,
  HtmlDomMeasurementProvider,
  HtmlMeasuredClientRect
} from "./types";

/**
 * Creates the identity-preserving browser geometry authority for retained HTML.
 *
 * @param options - Retained document, browser, surface, root, and region inputs.
 * @returns Document-local DOM measurement provider.
 */
export function createHtmlDomMeasurementProvider(
  options: CreateHtmlDomMeasurementProviderOptions
): HtmlDomMeasurementProvider {
  const cache = new HtmlMeasurementCache<readonly HtmlMeasuredClientRect[]>();
  const blockGeometry = createHtmlBlockHitGeometry(options);
  let rangeReadCount = 0;

  /**
   * Measures one collapsed position with descriptor-epoch caching.
   *
   * @param pos - Canonical document position.
   * @param side - Preferred side at a structural boundary.
   * @returns Cached or newly measured caret rectangle.
   */
  const coordsAtPos = (pos: number, side = 1): HtmlMeasuredClientRect => {
    const point = resolveHtmlMeasuredDomPoint(
      options.documentView,
      options.rootId,
      options.regionId,
      pos,
      side,
      options.projectDomPoint
    );
    const key = createHtmlMeasurementCacheKey(options, point.descriptorId, { from: pos, to: pos }, side < 0 ? "caret-before" : "caret");
    let rects = cache.get(key);
    if (!rects) {
      rects = measureHtmlDomRange(options.ownerDocument, point, point, true);
      rangeReadCount += 1;
      if (rects.length === 0 || point.node.nodeType === 1 && rects.some(rect => rect.right - rect.left > 1)) {
        rects = measureHtmlAdjacentInlineEdge(options, point, side) ?? resolveHtmlCollapsedPositionFallback(
          options,
          point.descriptorId,
          side,
          () => {
            rangeReadCount += 1;
          }
        );
      }
      if (!rects.length) rects = [resolveHtmlBoundaryRect(options, point.descriptorId, side, point)];
      cache.set(key, rects);
    }
    return rects[0] ?? resolveHtmlBoundaryRect(options, point.descriptorId, side, point);
  };

  return {
    updateBlockGeometry: blockGeometry.update,
    domAtPos: (pos, side = 0) => resolveHtmlMeasuredDomPoint(
      options.documentView,
      options.rootId,
      options.regionId,
      pos,
      side,
      options.projectDomPoint
    ),
    posAtDOM: (node, offset, bias = -1) => resolveHtmlMeasuredPosition(
      options.documentView,
      options.rootId,
      options.regionId,
      node,
      offset,
      bias
    ),
    coordsAtPos,
    selectionRects: (range) => measureHtmlTextSelectionRects(
      options,
      cache,
      range,
      () => {
        rangeReadCount += 1;
      }
    ),
    nodeSelectionRect: (pos) => measureNodeSelectionRect(options, pos),
    inputAnchor: coordsAtPos,
    posAtClientPoint: (left, top) => resolveHtmlPositionAtClientPoint(
      options,
      blockGeometry,
      left,
      top
    ),
    nodeDOM: (pos) => options.documentView.nodeDOM(pos),
    getRangeReadCount: () => rangeReadCount,
    resetRangeReadCount: () => {
      rangeReadCount = 0;
    },
    invalidate: () => cache.clear()
  };
}

/**
 * Measures one selected retained node from exact descriptor ownership.
 *
 * Node selections represent the outer node box rather than a text Range. The
 * retained facade therefore resolves the canonical node start first and then
 * attaches the same root, region, source, and descriptor identity used by all
 * other HTML geometry products.
 *
 * @param options - Retained document and mounted ownership inputs.
 * @param pos - Canonical position before the selected node.
 * @returns Owned client rectangle for the selected node.
 */
function measureNodeSelectionRect(
  options: CreateHtmlDomMeasurementProviderOptions,
  pos: number
): HtmlMeasuredClientRect {
  const node = options.documentView.nodeDOM(pos);
  const descriptor = node === null ? undefined : options.documentView.ownerAtDOM(node);
  if (!node || node.nodeType !== 1 || !descriptor || descriptor.destroyed) {
    throw new HtmlDomMappingGapError(
      `HTML node selection at ${pos} has no retained measurable owner.`
    );
  }
  const rect = (node as HTMLElement).getBoundingClientRect();
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    descriptorId: descriptor.id,
    source: descriptor.source,
    rootId: options.rootId,
    regionId: options.regionId
  };
}

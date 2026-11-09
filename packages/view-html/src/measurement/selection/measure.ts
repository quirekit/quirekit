import type { QuireDocumentRange } from "@quirekit/renderer";
import { groupQuireSelectionTextBands } from "@quirekit/ui";
import { createHtmlMeasurementCacheKey, type HtmlMeasurementCache } from "../cache";
import { htmlTextblockOwner } from "../owner";
import { resolveHtmlMeasuredDomPoint } from "../dom-point";
import { measureHtmlDomRange } from "../range";
import type { CreateHtmlDomMeasurementProviderOptions, HtmlMeasuredClientRect } from "../types";

/**
 * Measures cached text and opaque inline fragments with common visual-row edges.
 * @param options - Retained document and browser measurement inputs.
 * @param cache - Document-local immutable raw rectangle cache.
 * @param range - Canonical selection range to segment by retained inline owner.
 * @param recordRangeRead - Records each real browser Range read.
 * @returns Inline rectangles retaining exact horizontal coverage and provenance.
 */
export function measureHtmlTextSelectionRects(
  options: CreateHtmlDomMeasurementProviderOptions,
  cache: HtmlMeasurementCache<readonly HtmlMeasuredClientRect[]>,
  range: QuireDocumentRange,
  recordRangeRead: () => void
): readonly HtmlMeasuredClientRect[] {
  const groups = new Map<string, HtmlMeasuredClientRect[]>();
  for (const descriptor of options.documentView.descriptorsInRange(range)) {
    const inlineObject = (descriptor.kind === "node" || descriptor.kind === "node-view")
      && descriptor.node.isInline && !descriptor.mount?.contentDOM;
    if (descriptor.kind !== "text" && !inlineObject) continue;
    if (inlineObject && (descriptor.range.from < range.from || descriptor.range.to > range.to)) continue;
    const segment = { from: Math.max(range.from, descriptor.range.from), to: Math.min(range.to, descriptor.range.to) };
    if (segment.from >= segment.to) continue;
    const key = createHtmlMeasurementCacheKey(options, descriptor.id, segment, "selection");
    let rects = cache.get(key);
    if (!rects) {
      if (inlineObject) {
        // The opaque renderer owns its complete inline box. Traversing its label
        // would invent text offsets and omit decoration/padding from the selection.
        const dom = descriptor.mount?.dom;
        rects = dom?.nodeType === 1 ? Array.from((dom as Element).getClientRects())
          .filter(rect => rect.width > 0 && rect.height > 0)
          .map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
            descriptorId: descriptor.id, source: descriptor.source, rootId: options.rootId, regionId: options.regionId })) : [];
      } else {
        const start = resolveHtmlMeasuredDomPoint(options.documentView, options.rootId, options.regionId, segment.from, 1, options.projectDomPoint);
        const end = resolveHtmlMeasuredDomPoint(options.documentView, options.rootId, options.regionId, segment.to, -1, options.projectDomPoint);
        rects = measureHtmlDomRange(options.ownerDocument, start, end, false);
        recordRangeRead();
      }
      cache.set(key, rects);
    }
    // Retained textblock identity separates adjacent paragraphs/cells even when
    // their client boxes overlap. No product node names or document scans enter paint.
    const groupId = `${htmlTextblockOwner(descriptor)?.id ?? descriptor.id}:${descriptor.source.sourceId}`;
    const group = groups.get(groupId);
    if (group) group.push(...rects);
    else groups.set(groupId, [...rects]);
  }
  // Normalize only after all raw reads. Never cache a neighbour's height under a
  // text descriptor epoch, and never widen a fragment across an unselected bidi gap.
  return [...groups.values()].flatMap(rects => groupQuireSelectionTextBands(rects).flatMap(band =>
    band.rects.map(rect => rect.top === band.top && rect.bottom === band.bottom
      ? rect : { ...rect, top: band.top, bottom: band.bottom })
  ));
}

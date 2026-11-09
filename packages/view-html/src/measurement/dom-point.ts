import { HtmlDomMappingGapError, type HtmlDomPoint, type HtmlRetainedDocumentView } from "../document";
import type {
  HtmlMeasuredDomPoint,
  HtmlMeasuredPosition,
  HtmlMeasurementProvenance
} from "./types";

/**
 * Resolves a canonical position through the retained descriptor index.
 *
 * @param documentView - Retained document ownership facade.
 * @param rootId - Stable mounted root identity.
 * @param regionId - Stable continuous-flow region identity.
 * @param pos - Canonical document position.
 * @param side - Preferred boundary side.
 * @param project - Carries the point past transient DOM such as an IME preedit.
 * @returns Owned DOM point with complete provenance.
 */
export function resolveHtmlMeasuredDomPoint(
  documentView: HtmlRetainedDocumentView,
  rootId: string,
  regionId: string,
  pos: number,
  side: number,
  project?: <T extends HtmlDomPoint>(point: T) => T
): HtmlMeasuredDomPoint {
  const retained = documentView.domAtPos(pos, side);
  const point = project === undefined ? retained : project(retained);
  return {
    node: point.node,
    offset: point.offset,
    ...resolveHtmlMeasurementProvenance(
      documentView,
      rootId,
      regionId,
      point.descriptorId
    )
  };
}

/**
 * Accepts an owned DOM point and resolves its canonical position.
 *
 * @param documentView - Retained document ownership facade.
 * @param rootId - Stable mounted root identity.
 * @param regionId - Stable continuous-flow region identity.
 * @param node - Candidate DOM node.
 * @param offset - Candidate DOM offset.
 * @param bias - Preferred boundary side.
 * @returns Canonical position with complete provenance.
 */
export function resolveHtmlMeasuredPosition(
  documentView: HtmlRetainedDocumentView,
  rootId: string,
  regionId: string,
  node: Node,
  offset: number,
  bias: number
): HtmlMeasuredPosition {
  const owner = documentView.ownerAtDOM(node);
  if (!owner || owner.destroyed) {
    throw new HtmlDomMappingGapError(
      "DOM point is not owned by the retained HTML measurement root."
    );
  }
  // Labels and shapes inside a widget have no editable DOM offset. Both public
  // mapping and pointer hits use its mapped zero-width position, never a root fallback.
  const container = owner.kind === "widget" ? owner.parent : owner;
  return {
    pos: owner.kind === "widget" ? owner.range.from : documentView.posAtDOM(node, offset, bias),
    inside: container?.kind === "document" ? -1 : container?.range.from ?? -1,
    descriptorId: owner.id,
    source: owner.source,
    rootId,
    regionId
  };
}

/**
 * Resolves current descriptor provenance without inventing missing ownership.
 *
 * @param documentView - Retained document ownership facade.
 * @param rootId - Stable mounted root identity.
 * @param regionId - Stable continuous-flow region identity.
 * @param descriptorId - Exact descriptor identity.
 * @returns Complete current provenance.
 */
export function resolveHtmlMeasurementProvenance(
  documentView: HtmlRetainedDocumentView,
  rootId: string,
  regionId: string,
  descriptorId: string
): HtmlMeasurementProvenance {
  const descriptor = documentView.descriptorById(descriptorId);
  if (!descriptor || descriptor.destroyed) {
    throw new HtmlDomMappingGapError(
      `HTML measurement descriptor "${descriptorId}" is stale.`
    );
  }
  return { descriptorId, source: descriptor.source, rootId, regionId };
}

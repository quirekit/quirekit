import type { QuireViewPosAtCoordsResult } from "../geometry/types";
import type { QuireViewRenderResult } from "../../types";

/**
 * Carries a canonical document position into the frame document the retained
 * geometry was built from, which may hold IME preedit or presentation overlay
 * content the canonical document does not.
 *
 * @param renderResult - Frame whose geometry is queried.
 * @param pos - Canonical position.
 * @param side - Side of speculative content inserted exactly at the position to land on.
 * @returns Frame position.
 */
export function toFramePosition(renderResult: QuireViewRenderResult | undefined, pos: number, side: number): number {
  const mapping = renderResult?.canonicalPositionMapping;
  return mapping === undefined ? pos : mapping.map(pos, side < 0 ? -1 : 1);
}

/**
 * Carries a hit in the frame document back to canonical positions; a hit
 * inside speculative content lands where that content starts.
 *
 * @param renderResult - Frame the hit was resolved in.
 * @param hit - Hit in frame positions.
 * @returns Hit in canonical positions.
 */
export function toCanonicalHit(renderResult: QuireViewRenderResult | undefined, hit: QuireViewPosAtCoordsResult): QuireViewPosAtCoordsResult {
  const mapping = renderResult?.canonicalPositionMapping;
  if (mapping === undefined) return hit;
  const back = mapping.invert();
  return {
    ...hit,
    pos: back.map(hit.pos, -1),
    inside: hit.inside < 0 ? hit.inside : back.map(hit.inside, 1),
    ...(hit.objectPosition === undefined ? {} : { objectPosition: back.map(hit.objectPosition, 1) })
  };
}

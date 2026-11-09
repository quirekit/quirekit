import type { Node as ProseMirrorNode } from "@quirekit/pm";
import type { QuireDocumentRange, QuireRect } from "@quirekit/renderer";
import type { QuireLayoutNode } from "@quirekit/view-engine";
import type { HtmlDescriptor } from "../../descriptors";

/** Legacy WebKit caret API, absent in some DOM library versions. */
export type HtmlWebKitCaretDocument = Document & {
  /** Optional legacy point-to-caret fallback. */
  caretRangeFromPoint?: ((x: number, y: number) => Range | null) | undefined;
};

/** Balanced bounds over already measured continuous-flow leaf blocks. */
export interface HtmlBlockHitTree {
  /** Union of descendant rectangles in surface-local CSS coordinates. */
  readonly rect: QuireRect;
  /** Canonical range containing all descendants. */
  readonly range: QuireDocumentRange;
  /** A terminal measured block, absent on branches. */
  readonly block?: QuireLayoutNode;
  /** First balanced branch. */
  readonly first?: HtmlBlockHitTree;
  /** Second balanced branch. */
  readonly second?: HtmlBlockHitTree;
}

/** Nearest leaf and deterministic work count for a spatial query. */
export interface HtmlBlockHitQuery {
  /** Nearest eligible measured leaf. */
  readonly block: QuireLayoutNode | null;
  /** Number of tree bounds examined, including pruned branches. */
  readonly visited: number;
}

/** A current retained owner projected back to browser viewport coordinates. */
export interface HtmlBlockHitTarget {
  /** Exact descriptor from the same document as the measured geometry. */
  readonly descriptor: HtmlDescriptor;
  /** Block rectangle in client CSS pixels. */
  readonly rect: QuireRect;
}

/** Geometry lifecycle shared by all HTML point-to-position consumers. */
export interface HtmlBlockHitGeometry {
  /**
   * Publishes existing measured blocks; an identical root reuses its index.
   * @param root - Current continuous-flow block geometry.
   * @param document - Canonical document represented by those blocks.
   * @param changed - Verified topology-preserving changes, when available.
   */
  update(root: QuireLayoutNode, document: ProseMirrorNode, changed?: ReadonlyMap<string, QuireLayoutNode>): void;
  /**
   * Resolves a local block without reading every mounted element.
   * @param left - Viewport x coordinate.
   * @param top - Viewport y coordinate.
   * @param scope - Optional enclosing content owner's canonical range.
   * @returns Current nearest block, or null for unavailable/stale geometry.
   */
  atPoint(left: number, top: number, scope?: QuireDocumentRange): HtmlBlockHitTarget | null;
}

/** Browser caret proposal before retained ownership has accepted it. */
export interface HtmlCaretCandidate {
  /** Proposed DOM node. */
  readonly node: Node;
  /** Proposed child or text offset. */
  readonly offset: number;
}

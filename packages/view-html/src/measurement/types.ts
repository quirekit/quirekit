import type { QuireDocumentRange } from "@quirekit/renderer";
import type { Node as ProseMirrorNode } from "@quirekit/pm";
import type { QuireLayoutNode } from "@quirekit/view-engine";
import type {
  QuireLayoutSourceRef
} from "@quirekit/layout/identity";
import type { HtmlDomPoint, HtmlRetainedDocumentView } from "../document";

/** Provenance carried by every retained HTML measurement answer. */
export interface HtmlMeasurementProvenance {
  /** Descriptor that authoritatively owns the measured DOM product. */
  readonly descriptorId: string;
  /** Canonical document or extension source represented by the descriptor. */
  readonly source: QuireLayoutSourceRef;
  /** Stable mounted HTML root identity. */
  readonly rootId: string;
  /** Stable continuous-flow region identity inside the root. */
  readonly regionId: string;
}

/** Descriptor-owned DOM point for one canonical document position. */
export interface HtmlMeasuredDomPoint extends HtmlMeasurementProvenance {
  /** DOM node that realizes the canonical position. */
  readonly node: Node;
  /** DOM offset within the measured node. */
  readonly offset: number;
}

/** Canonical position accepted from an owned browser DOM point. */
export interface HtmlMeasuredPosition extends HtmlMeasurementProvenance {
  /** Canonical document position. */
  readonly pos: number;
  /** Position before the containing node, or -1 for the document root. */
  readonly inside: number;
  /** A direct hit on a selectable atomic block, rather than a text caret. */
  readonly nodeSelection?: boolean;
}

/** Client-space rectangle produced from retained DOM Range geometry. */
export interface HtmlMeasuredClientRect extends HtmlMeasurementProvenance {
  /** Left edge in viewport CSS pixels. */
  readonly left: number;
  /** Right edge in viewport CSS pixels. */
  readonly right: number;
  /** Top edge in viewport CSS pixels. */
  readonly top: number;
  /** Bottom edge in viewport CSS pixels. */
  readonly bottom: number;
}

/** Inputs used to create the retained HTML measurement provider. */
export interface CreateHtmlDomMeasurementProviderOptions {
  /** Retained document facade that owns all accepted DOM points. */
  readonly documentView: HtmlRetainedDocumentView;
  /** Browser document used for Range and point-to-caret APIs. */
  readonly ownerDocument: Document;
  /** Content surface used to reject points outside the retained document. */
  readonly surface: HTMLElement;
  /** Stable mounted HTML root identity. */
  readonly rootId: string;
  /** Stable continuous-flow document region identity. */
  readonly regionId: string;
  /**
   * Carries canonical DOM points past transient DOM such as an IME preedit.
   *
   * @param point - DOM point from retained ownership.
   * @returns Point valid in the current DOM.
   */
  readonly projectDomPoint?: <T extends HtmlDomPoint>(point: T) => T;
}

/** Identity-preserving DOM geometry authority for one retained HTML root. */
export interface HtmlDomMeasurementProvider {
  /**
   * Publishes measured block geometry for spatial gap ownership.
   * @param root - Current continuous-flow geometry; identical roots reuse their index.
   * @param document - Canonical document represented by this geometry.
   * @param changed - Verified stable-topology range and rectangle changes, when available.
   */
  updateBlockGeometry(root: QuireLayoutNode, document: ProseMirrorNode, changed?: ReadonlyMap<string, QuireLayoutNode>): void;
  /**
   * Maps a canonical position to an owned DOM point.
   *
   * @param pos - Canonical document position.
   * @param side - Preferred side at a structural boundary.
   * @returns Owned DOM point with complete provenance.
   */
  domAtPos(pos: number, side?: number): HtmlMeasuredDomPoint;
  /**
   * Maps an owned DOM point back to a canonical position.
   *
   * @param node - DOM node owned by the retained descriptor tree.
   * @param offset - Offset within the DOM node.
   * @param bias - Preferred side at a structural boundary.
   * @returns Canonical position with complete provenance.
   */
  posAtDOM(node: Node, offset: number, bias?: number): HtmlMeasuredPosition;
  /**
   * Measures the collapsed caret rectangle for a canonical position.
   *
   * @param pos - Canonical document position.
   * @param side - Preferred side at a structural boundary.
   * @returns Client rectangle with complete provenance.
   */
  coordsAtPos(pos: number, side?: number): HtmlMeasuredClientRect;
  /**
   * Measures browser line fragments for a canonical selection range.
   *
   * @param range - Canonical selection range.
   * @returns Ordered client rectangles with complete provenance.
   */
  selectionRects(range: QuireDocumentRange): readonly HtmlMeasuredClientRect[];
  /**
   * Measures the retained outer box selected by a node selection.
   *
   * @param pos - Canonical position before the selected node.
   * @returns Owned client rectangle for the selected node.
   */
  nodeSelectionRect(pos: number): HtmlMeasuredClientRect;
  /**
   * Measures the candidate-window anchor after input or preedit content.
   *
   * @param pos - Canonical anchor position.
   * @param side - Preferred side at a structural boundary.
   * @returns Client rectangle with complete provenance.
   */
  inputAnchor(pos: number, side?: number): HtmlMeasuredClientRect;
  /**
   * Accepts a browser caret candidate only when retained ownership proves it.
   *
   * @param left - Viewport x coordinate.
   * @param top - Viewport y coordinate.
   * @returns Canonical position with provenance, or null outside retained ownership.
   */
  posAtClientPoint(left: number, top: number): HtmlMeasuredPosition | null;
  /**
   * Resolves the retained outer DOM node beginning at a canonical position.
   *
   * @param pos - Position before a schema node.
   * @returns Retained node DOM, or null when no node starts there.
   */
  nodeDOM(pos: number): Node | null;
  /**
   * Reads DOM Range calls performed since the last counter reset.
   *
   * @returns Current document-local Range read count.
   */
  getRangeReadCount(): number;
  /** Resets the document-local Range read counter before a geometry batch. */
  resetRangeReadCount(): void;
  /** Clears all cached Range measurements. */
  invalidate(): void;
}

/** Cache identity for one DOM Range geometry answer. */
export interface HtmlMeasurementCacheKey {
  /** Descriptor owning the measured start point. */
  readonly descriptorId: string;
  /** Descriptor geometry epoch at measurement time. */
  readonly geometryEpoch: number;
  /** Canonical measured range. */
  readonly range: QuireDocumentRange;
  /** Surface projection signature in client coordinates. */
  readonly projection: string;
  /** Measurement product kind. */
  readonly kind: "caret" | "caret-before" | "selection";
}

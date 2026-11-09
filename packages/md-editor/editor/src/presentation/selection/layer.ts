import { Direction, layer, type EditorView, type LayerMarker } from "@quirekit/cm-view";
import { readSourcePresentation } from "@quirekit/msfe-core";
import { selectionPath } from "./path";
import { flattenSelectionLines } from "./lines";
import type { SelectionPaintRect } from "./types";

/** One passive path; overlapping parent and text rectangles share one alpha blend. */
class DocumentSelectionMarker implements LayerMarker {
  /** @param path - Measured, clipped path in CM layer coordinates. @param owner - The editor's document, including iframe mounts. */
  constructor(private readonly path: string, private readonly owner: Document) {}

  /** @param other - Previous marker. @returns Whether the painted geometry is unchanged. */
  eq(other: LayerMarker): boolean { return other instanceof DocumentSelectionMarker && other.path === this.path; }

  /** @returns An inert native layer marker that never participates in editor layout. */
  draw(): HTMLElement {
    const element = this.owner.createElement("div"); element.className = "md-document-selection";
    const svg = this.owner.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "1"); svg.setAttribute("height", "1"); svg.setAttribute("aria-hidden", "true");
    const path = this.owner.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill-rule", "nonzero"); path.setAttribute("d", this.path);
    svg.append(path); element.append(svg); return element;
  }

  /** @param element - Existing marker. @param previous - Previously painted marker. @returns Whether the existing SVG was reused. */
  update(element: HTMLElement, previous: LayerMarker): boolean {
    if (!(previous instanceof DocumentSelectionMarker)) return false;
    element.firstElementChild!.firstElementChild!.setAttribute("d", this.path); return true;
  }
}

/** @param range - Selected DOM range. @param element - Candidate block widget. @returns Whether the range covers the whole element. */
function covers(range: Range, element: Element): boolean {
  const inner = element.ownerDocument.createRange(); inner.selectNode(element);
  return range.compareBoundaryPoints(Range.START_TO_START, inner) <= 0 && range.compareBoundaryPoints(Range.END_TO_END, inner) >= 0;
}

/** @param view - Canonical selection and viewport owner. @returns At most one path for every visible native range. */
export function measureDocumentSelection(view: EditorView): readonly LayerMarker[] {
  const presentation = readSourcePresentation(view.state);
  if (presentation.mode === "source" || presentation.composing || view.state.selection.ranges.every(range => range.empty)) return [];

  // Only mounted source positions are mapped. DOM Range owns wrapping, bidi and
  // nested surface geometry; source line breaks must not bridge hidden fences.
  const fragments: SelectionPaintRect[] = [];
  for (const selection of view.state.selection.ranges) {
    const from = Math.max(selection.from, view.viewport.from), to = Math.min(selection.to, view.viewport.to);
    if (from >= to) continue;
    const start = view.domAtPos(from, 1), end = view.domAtPos(to, -1);
    const range = view.dom.ownerDocument.createRange();
    range.setStart(start.node, start.offset); range.setEnd(end.node, end.offset);
    // Paint text, not boxes: every selected source line is measured within its own line, so
    // fully selected blocks hug their text as rich editors do. Block widgets between lines,
    // such as previews, are painted whole when the range covers them.
    const textRects: DOMRect[][] = [], cellRects: DOMRect[] = [];
    // A range that leaves its cell selects cells: every cell it touches is painted whole,
    // including the endpoint cells; within one cell it hugs the text like any line.
    const cell = (node: Node) => (node.nodeType === 1 ? node as Element : node.parentElement)?.closest(".msfe-table-cell");
    const acrossCells = cell(start.node) !== cell(end.node);
    // A code fence's boundary rows carry only its toolbar, which is chrome rather than text.
    for (const line of view.contentDOM.querySelectorAll(".cm-line:not(.msfe-code-start, .msfe-code-end)")) {
      if (!range.intersectsNode(line)) continue;
      if (acrossCells && line.classList.contains("msfe-table-row")) {
        for (const owner of line.querySelectorAll(".msfe-table-cell")) if (range.intersectsNode(owner)) cellRects.push(owner.getBoundingClientRect());
        continue;
      }
      const local = range.cloneRange();
      if (!line.contains(start.node)) local.setStart(line, 0);
      if (!line.contains(end.node)) local.setEnd(line, line.childNodes.length);
      textRects.push([...local.getClientRects()]);
    }
    const rects = [...view.contentDOM.querySelectorAll("[contenteditable=false]")]
      .filter(widget => !widget.closest(".cm-line") && !widget.parentElement?.closest("[contenteditable=false]") && covers(range, widget))
      .map(widget => widget.getBoundingClientRect());
    fragments.push(...flattenSelectionLines([...rects, ...cellRects], textRects));
  }
  if (!fragments.length) return [];

  // Match CM's layer origin including RTL scroll and CSS scale, then clip the
  // measured fragments to the document padding box so controls stay unselected.
  const scroller = view.scrollDOM.getBoundingClientRect(), content = view.contentDOM.getBoundingClientRect();
  const style = view.dom.ownerDocument.defaultView!.getComputedStyle(view.contentDOM);
  const origin = {
    left: (view.textDirection === Direction.LTR ? scroller.left : scroller.right - view.scrollDOM.clientWidth * view.scaleX)
      - view.scrollDOM.scrollLeft * view.scaleX,
    top: scroller.top - view.scrollDOM.scrollTop * view.scaleY,
  };
  const clip = { left: content.left + (Number.parseFloat(style.paddingLeft) || 0) * view.scaleX,
    right: content.right - (Number.parseFloat(style.paddingRight) || 0) * view.scaleX, top: content.top, bottom: content.bottom };
  const path = selectionPath(fragments, clip, origin);
  return path ? [new DocumentSelectionMarker(path, view.dom.ownerDocument)] : [];
}

/** Rich document selection paint; CodeMirror retains every input, range and cursor behavior. */
export const proseDocumentSelection = layer({
  above: true,
  class: "md-document-selection-layer",
  markers: measureDocumentSelection,
  /** @param update - Accepted native state dependencies. @returns Whether range geometry needs remeasurement. */
  update(update) {
    return update.docChanged || update.selectionSet || update.viewportChanged
      || readSourcePresentation(update.startState).composing !== readSourcePresentation(update.state).composing
      || readSourcePresentation(update.startState).mode !== readSourcePresentation(update.state).mode;
  },
});

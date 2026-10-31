import { ViewPlugin, type EditorView, type ViewUpdate } from "@quirekit/cm-view";
import { commentsState } from "../state/slot";

/** Rendered components that replace source: product widgets and node views. */
const COMPONENTS = ".msfe-component-view, .msfe-node-view";

/**
 * Marks rendered components whose source lies inside an unresolved comment. Block components replace whole lines,
 * so the text highlight cannot reach them; the marker attribute lets the theme outline them instead.
 * Work is bounded by the components in the viewport and only runs when text, viewport or comments change.
 */
export const commentedComponents = ViewPlugin.fromClass(class {
  /** @param view - Mounted editor. */
  constructor(readonly view: EditorView) { this.schedule(); }

  /** @param update - View update; remeasures after text, viewport or comment changes. */
  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || commentsState.read(update.startState) !== commentsState.read(update.state)) this.schedule();
  }

  /** Reads positions and writes attributes in CodeMirror's measure cycle, after the DOM is current. */
  schedule(): void {
    this.view.requestMeasure({ key: this, read: view => {
      const state = commentsState.read(view.state);
      return [...view.contentDOM.querySelectorAll<HTMLElement>(COMPONENTS)].map(element => {
        // Inline components inside a highlighted span already show the comment.
        if (element.closest(".msfe-comment")) return { element, value: null };
        let pos: number;
        try { pos = view.posAtDOM(element); } catch { return { element, value: null }; }
        const ids = state.ranges.between(pos, pos).filter(range => range.from < range.to && range.from <= pos && pos < range.to && !state.threads.get(range.id)?.resolved).map(range => range.id);
        return { element, value: ids.length ? ids.includes(state.active ?? "") ? "active" : "" : null };
      });
    }, write: entries => {
      for (const { element, value } of entries) {
        if (value === null) element.removeAttribute("data-msfe-commented");
        else if (element.getAttribute("data-msfe-commented") !== value) element.setAttribute("data-msfe-commented", value);
      }
    } });
  }
});

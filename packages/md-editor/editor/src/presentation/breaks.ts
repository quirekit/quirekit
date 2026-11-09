import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@quirekit/cm-view";
import type { Range } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import { readSourcePresentation } from "@quirekit/msfe-core";

/** A line break drawn in place of its `<br>` source. */
class BreakWidget extends WidgetType {
  /** @returns A native line break; editing hosts place a caret after it on the next line, which an empty block box does not guarantee in WebKit. */
  toDOM(): HTMLElement {
    const element = document.createElement("br");
    element.className = "md-break";
    return element;
  }

  /** @returns Every break draws the same. */
  eq(): boolean { return true; }
}

const breakWidget = Decoration.replace({ widget: new BreakWidget() });

/** @param view - Mounted editor. @returns `<br>` tags drawn as line breaks in document presentations. */
function breaks(view: EditorView): DecorationSet {
  if (readSourcePresentation(view.state).mode !== "live") return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) syntaxTree(view.state).iterate({ from, to, enter: node => {
    if (node.name === "HTMLTag" && /^<br\s*\/?>$/iu.test(view.state.sliceDoc(node.from, node.to))) ranges.push(breakWidget.range(node.from, node.to));
  } });
  return Decoration.set(ranges, true);
}

/**
 * Inline `<br>`, the line break a GFM table cell can hold, reads as a break and moves and deletes
 * as one character; source editing keeps the tag literal.
 */
export const lineBreakTags = ViewPlugin.fromClass(class {
  /** Current break widgets. */ decorations: DecorationSet;
  /** @param view - Mounted editor. */
  constructor(view: EditorView) { this.decorations = breaks(view); }
  /** @param update - Accepted view change. */
  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || readSourcePresentation(update.startState) !== readSourcePresentation(update.state)
      || syntaxTree(update.startState) !== syntaxTree(update.state)) this.decorations = breaks(update.view);
  }
}, { decorations: value => value.decorations,
  provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.decorations ?? Decoration.none) });

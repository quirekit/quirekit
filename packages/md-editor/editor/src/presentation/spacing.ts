import { Decoration, ViewPlugin, EditorView, type DecorationSet, type ViewUpdate } from "@quirekit/cm-view";
import { readSourcePresentation, editingBoundaries } from "@quirekit/msfe-core";
import type { Range } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import { collapseBlankLine, continuationRow, emptyParagraphRow, separatorBoundary } from "./boundaries/separator";

export { collapseBlankLine } from "./boundaries/separator";

/** @param view - Current visible source. @returns Stable separator geometry and native navigation exclusions. */
function spacing(view: EditorView) {
  const { mode } = readSourcePresentation(view.state);
  if (mode === "source") return { decorations: Decoration.none, atomic: Decoration.none };
  const ranges: Range<Decoration>[] = [], atomic: Range<Decoration>[] = [];
  for (const visible of view.visibleRanges) {
    let line = view.state.doc.lineAt(visible.from);
    while (line.from <= visible.to) {
      if (continuationRow(view.state, line)) ranges.push(Decoration.line({ class: "md-continuation-row" }).range(line.from));
      else if (emptyParagraphRow(view.state, line)) ranges.push(Decoration.line({ class: "md-empty-paragraph" }).range(line.from));
      if (collapseBlankLine(view.state, line)) {
        ranges.push(Decoration.line({ class: "md-separator-line" }).range(line.from));
        // The two source breaks are internal to the atom. Its endpoints remain
        // the neighboring line edges, including any authored empty paragraph.
        atomic.push(Decoration.replace({}).range(line.from - 1, line.to + 1));
      }
      if (line.to >= view.state.doc.length) break;
      line = view.state.doc.lineAt(line.to + 1);
    }
  }
  return { decorations: Decoration.set(ranges, true), atomic: Decoration.set(atomic, true) };
}

/** Visible-line work only; source-reveal selection is frozen by MSFE during pointer/IME gestures. */
export const proseSpacing = ViewPlugin.fromClass(class {
  /** Current visible line styles. */ decorations: DecorationSet;
  /** Navigation shares the accepted role decisions without rebuilding on caret motion. */ atomic: DecorationSet;
  /** @param view - Mounted canonical view. */
  constructor(view: EditorView) { const value = spacing(view); this.decorations = value.decorations; this.atomic = value.atomic; }
  /** @param update - Accepted view change. */
  update(update: ViewUpdate): void {
    const before = readSourcePresentation(update.startState), after = readSourcePresentation(update.state);
    if (update.docChanged || update.viewportChanged || before.mode !== after.mode || before.reveal !== after.reveal
      || syntaxTree(update.startState) !== syntaxTree(update.state) || update.startState.readOnly !== update.state.readOnly) {
      Object.assign(this, spacing(update.view));
    }
  }
}, { decorations: value => value.decorations,
  provide: plugin => [editingBoundaries([separatorBoundary]),
    EditorView.atomicRanges.of(view => view.plugin(plugin)?.atomic ?? Decoration.none)],
});

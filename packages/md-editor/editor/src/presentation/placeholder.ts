import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@quirekit/cm-view";
import type { Range } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import { readSourcePresentation } from "@quirekit/msfe-core";
import { collapseBlankLine } from "./boundaries/separator";

/** Blocks whose empty rows are literal content, never a paragraph to hint at. */
const literal = new Set(["FencedCode", "CodeBlock", "Table", "Frontmatter", "HTMLBlock", "ListItem", "DisplayMath"]);

/** @param text - Hint text. @returns A line marked to show the hint without taking layout or caret positions. */
function hint(text: string) {
  return Decoration.line({ class: "md-line-placeholder", attributes: { "data-placeholder": text } });
}

/**
 * Empty headings always name their level; the empty paragraph holding the caret hints at the
 * slash menu. Empty list items and literal blocks show only their own markers.
 * @param view - Mounted editor. @param paragraph - Hint for an empty paragraph.
 * @returns Line hints for the visible document.
 */
function hints(view: EditorView, paragraph: string): DecorationSet {
  const { state } = view;
  if (readSourcePresentation(state).mode !== "live" || state.readOnly || !state.doc.length) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) syntaxTree(state).iterate({ from, to, enter: node => {
    const level = /^ATXHeading([1-6])$/u.exec(node.name)?.[1];
    if (!level) return;
    const line = state.doc.lineAt(node.from);
    if (/^#{1,6}\s*$/u.test(state.sliceDoc(line.from + /^\s*/u.exec(line.text)![0].length, line.to))) ranges.push(hint(`H${level}`).range(line.from));
    return false;
  } });
  const { main } = state.selection;
  if (view.hasFocus && main.empty) {
    const line = state.doc.lineAt(main.head);
    let owner = syntaxTree(state).resolveInner(main.head, -1), inside = false;
    for (let node: typeof owner | null = owner; node; node = node.parent) if (literal.has(node.name)) inside = true;
    // A collapsed separator has no line box; a hint there would draw over the row above.
    if (!inside && /^(?:[ \t]*>[ \t]?)*[ \t]*$/u.test(line.text) && !collapseBlankLine(state, line) && !ranges.some(range => range.from === line.from)) ranges.push(hint(paragraph).range(line.from));
  }
  return Decoration.set(ranges, true);
}

/**
 * Inline hints on empty rows, as rich editors show them.
 * @param paragraph - Hint for the empty paragraph holding the caret.
 * @returns The view extension.
 */
export function linePlaceholders(paragraph: string) {
  return ViewPlugin.fromClass(class {
    /** Current hints. */ decorations: DecorationSet;
    /** @param view - Mounted editor. */
    constructor(view: EditorView) { this.decorations = hints(view, paragraph); }
    /** @param update - Accepted view change. */
    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.focusChanged || update.viewportChanged
        || readSourcePresentation(update.startState) !== readSourcePresentation(update.state) || syntaxTree(update.startState) !== syntaxTree(update.state)) {
        this.decorations = hints(update.view, paragraph);
      }
    }
  }, { decorations: value => value.decorations });
}

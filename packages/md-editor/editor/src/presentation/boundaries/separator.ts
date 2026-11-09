import { readSourcePresentation, type EditingBoundaryRule } from "@quirekit/msfe-core";
import type { EditorState, Line } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";

/** Only gaps in known Prose flow may collapse; plugin-owned source remains literal by default. */
const proseFlow = new Set(["Document", "Blockquote", "QuoteMark", "BulletList", "OrderedList", "ListItem", "CustomContainer"]);

/** @param text - One source line. @returns Whether only paragraph/quote separation occupies this line. */
function blankSeparator(text: string): boolean { return /^\s*(?:>\s*)*$/u.test(text); }

/**
 * @param state - Canonical source. @param line - Blank source line.
 * @returns Whether Shift-Enter left this row after a hard break with a separator still below it;
 * the row keeps its line box for the caret and the separator below collapses instead.
 */
function breakRow(state: EditorState, line: Line): boolean {
  return line.number > 1 && line.number < state.doc.lines && blankSeparator(line.text)
    && /(?: {2,}|\\)$/u.test(state.doc.line(line.number - 1).text) && blankSeparator(state.doc.line(line.number + 1).text);
}

/** @param state - Canonical source and accepted presentation. @param line - Visible source line. @returns Whether this source separator can safely lose its line box. */
export function collapseBlankLine(state: EditorState, line: Line): boolean {
  const { mode } = readSourcePresentation(state);
  if (mode === "source" || !blankSeparator(line.text)) return false;
  let flowEnd = state.doc.length;
  // The final prefix on a nested blank row belongs to its innermost flow.
  // Its terminal row is authored content, just like the document's EOF row.
  for (let owner: SyntaxNode | null = syntaxTree(state).resolveInner(line.to, -1); owner; owner = owner.parent) {
    if (!proseFlow.has(owner.name)) return false;
    // The first row of a container's body separates nothing: it is where the body's text goes.
    if (owner.name === "CustomContainer" && state.doc.lineAt(owner.from).number === line.number - 1) return false;
    if (owner.name !== "QuoteMark") flowEnd = Math.min(flowEnd, owner.to);
  }
  // Structural separators use existing paragraph margins in every caret state.
  // Authored empty paragraphs and EOF still own real line boxes, so Enter is
  // visible immediately without adding height when merely moving the caret.
  if (line.from === 0 || line.to >= flowEnd || breakRow(state, line)) return false;
  const previous = state.doc.line(line.number - 1);
  if (!blankSeparator(previous.text) || breakRow(state, previous)) return true;
  // The last row of a longer blank run separates the empty paragraphs above it from the next block,
  // so an opened row shows as one line rather than two that shrink once typing starts.
  // A container's closing fence is not a block: the run's last row there is where its body text goes.
  const next = state.doc.line(line.number + 1).text;
  return line.number > 2 && blankSeparator(state.doc.line(line.number - 2).text) && !blankSeparator(next) && !/^\s*:{3,}\s*$/u.test(next);
}

/**
 * @param state - Canonical source. @param line - Visible source line.
 * @returns Whether this empty row continues the paragraph line above it (a quote row ending its quote,
 * or the row after a hard break): text typed there joins that paragraph, so it is drawn without the paragraph gap.
 */
export function continuationRow(state: EditorState, line: Line): boolean {
  if (readSourcePresentation(state).mode === "source" || !blankSeparator(line.text) || line.number === 1 || collapseBlankLine(state, line)) return false;
  const previous = state.doc.line(line.number - 1);
  if (blankSeparator(previous.text)) return false;
  return /^\s*>/u.test(line.text) ? /^\s*>/u.test(previous.text) : hardBreakEnd(previous.text);
}

/** @param text - Source line. @returns Whether it ends with a Markdown hard break. */
function hardBreakEnd(text: string): boolean {
  return /(?: {2,}|\\)$/u.test(text);
}

/**
 * @param state - Canonical source. @param line - Visible source line.
 * @returns Whether this is a visible empty row between document blocks: an empty paragraph, drawn with
 * paragraph spacing so typing into it does not move it.
 */
export function emptyParagraphRow(state: EditorState, line: Line): boolean {
  if (readSourcePresentation(state).mode === "source" || line.text || collapseBlankLine(state, line) || breakRow(state, line)) return false;
  if (line.number > 1 && hardBreakEnd(state.doc.line(line.number - 1).text)) return false;
  // A container body holds paragraphs like the document does; its last row touches the closing fence.
  const tree = syntaxTree(state), flows = ["Document", "CustomContainer"];
  return flows.includes(tree.resolveInner(line.from, 1).name) || flows.includes(tree.resolveInner(line.from, -1).name);
}

/** One collapsed separator uses neighboring paragraph edges for every operation. */
export const separatorBoundary: EditingBoundaryRule = { nodes: ["Document"], when: "prose",
  /** @param context - Current line and canonical source. @returns A navigable interval whose deletion still joins paragraphs natively. */
  resolve({ state, position }) {
    const line = state.doc.lineAt(position);
    return collapseBlankLine(state, line) ? { from: line.from - 1, to: line.to + 1, contentFrom: line.from - 1,
      contentTo: line.to + 1, kind: "separator", deletion: "native" } : null;
  },
};

import { EditorSelection, countColumn, type ChangeSpec, type EditorState, type Line, type SelectionRange } from "@quirekit/cm-state";
import { getIndentUnit, indentString, syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import type { MsfeCommand } from "@quirekit/msfe-core";

/** Editable body lines of one fenced block, excluding both fence lines. */
interface CodeBody {
  /** Confirmed fenced block. */
  readonly node: SyntaxNode;
  /** First body line number. */
  readonly first: number;
  /** Last body line number. */
  readonly last: number;
}

/** @param state - Canonical source. @param pos - Selection endpoint. @returns The fenced body containing `pos`, or null on fences and outside code. */
function codeBodyAt(state: EditorState, pos: number): CodeBody | null {
  const tree = syntaxTree(state);
  for (const side of [-1, 1] as const) {
    let node: SyntaxNode | null = tree.resolveInner(pos, side);
    while (node && node.name !== "FencedCode") node = node.parent;
    if (!node) continue;
    const marks = node.getChildren("CodeMark"), doc = state.doc;
    const first = doc.lineAt(node.from).number + 1;
    const last = marks.length === 2 ? doc.lineAt(marks[1]!.from).number - 1 : doc.lineAt(node.to).number;
    const line = doc.lineAt(pos).number;
    if (line >= first && line <= last) return { node, first, last };
  }
  return null;
}

/** @param body - Owning block. @param line - Body line. @returns Start of the code text after quote and list prefixes; the line end when the line holds no code. */
function codeStart(body: CodeBody, line: Line): number {
  // CodeText begins after container markers and keeps the code's own indentation;
  // adjacent chunks merge, so one chunk may already cover this line from its start.
  for (let child = body.node.childAfter(line.from); child && child.from < line.to; child = child.nextSibling) {
    if (child.name === "CodeText") return Math.max(child.from, line.from);
  }
  return line.to;
}

/** @param state - Canonical source. @param range - Non-empty selection. @returns Lines the range covers, excluding a trailing line it only touches at column 0. */
function coveredLines(state: EditorState, range: SelectionRange): [number, number] {
  const first = state.doc.lineAt(range.from), last = state.doc.lineAt(range.to);
  return [first.number, range.to === last.from && last.number > first.number ? last.number - 1 : last.number];
}

/**
 * Code-editor Tab behavior inside fenced code.
 * @param direction - Indent or outdent.
 * @returns A command inserting spaces at an empty caret, or shifting every covered line; null when any range leaves a code body.
 */
export function indentCode(direction: 1 | -1): MsfeCommand {
  return state => {
    const bodies = state.selection.ranges.map(range => {
      const body = codeBodyAt(state, range.from);
      return body && state.doc.lineAt(range.to).number <= body.last ? body : null;
    });
    if (bodies.some(body => !body)) return null;
    const unit = getIndentUnit(state);
    // An empty caret behaves like a code editor's Tab: pad to the next indent stop.
    if (direction > 0 && state.selection.ranges.every(range => range.empty)) {
      return { ...state.changeByRange(range => {
        const index = state.selection.ranges.indexOf(range), line = state.doc.lineAt(range.head);
        const column = countColumn(state.sliceDoc(codeStart(bodies[index]!, line), range.head), state.tabSize);
        const insert = indentString(state, unit - column % unit);
        return { changes: { from: range.head, insert }, range: EditorSelection.cursor(range.head + insert.length) };
      }), scrollIntoView: true };
    }
    const changes: ChangeSpec[] = [], seen = new Set<number>();
    state.selection.ranges.forEach((range, index) => {
      const [from, to] = range.empty ? [state.doc.lineAt(range.head).number, state.doc.lineAt(range.head).number] : coveredLines(state, range);
      for (let number = from; number <= to; number++) {
        if (seen.has(number)) continue;
        seen.add(number);
        const line = state.doc.line(number), start = codeStart(bodies[index]!, line);
        if (start === line.to) continue;
        if (direction > 0) { changes.push({ from: start, insert: indentString(state, unit) }); continue; }
        const whitespace = /^[ \t]*/u.exec(state.sliceDoc(start, line.to))![0];
        let remove = 0;
        while (remove < whitespace.length && countColumn(whitespace.slice(0, remove + 1), state.tabSize) <= unit) remove++;
        if (remove) changes.push({ from: start, to: start + remove });
      }
    });
    if (!changes.length) return direction > 0 ? null : { selection: state.selection };
    const edits = state.changes(changes);
    return { changes: edits, selection: state.selection.map(edits, 1), scrollIntoView: true };
  };
}

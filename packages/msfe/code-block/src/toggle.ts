import { EditorSelection, type EditorState, type Line, type SelectionRange } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import type { MsfeCommand } from "@quirekit/msfe-core";
import { fencedAt } from "./query";

const containerMarks = new Set(["QuoteMark", "ListMark", "TaskMarker"]);

/** @param state - Parsed source. @param line - First wrapped line. @returns Where the line's content starts after container markers and indentation. */
function contentStart(state: EditorState, line: Line): number {
  let end = line.from;
  syntaxTree(state).iterate({ from: line.from, to: line.to, enter: node => {
    if (containerMarks.has(node.name) && node.from >= line.from) end = Math.max(end, node.to);
  } });
  while (end < line.to && /[ \t]/u.test(state.sliceDoc(end, end + 1))) end++;
  return end;
}

/** @param fence - Fenced block. @param line - Body line. @returns Start of the line's code after container prefixes, or its end when it holds none. */
function codeStart(fence: SyntaxNode, line: Line): number {
  for (let child = fence.childAfter(line.from); child && child.from < line.to; child = child.nextSibling) {
    if (child.name === "CodeText") return Math.max(child.from, line.from);
  }
  return line.to;
}

/** @param state - Parsed source. @param fence - Block to unwrap. @returns Removal of both fences, keeping the body as text in the same container. */
function unwrap(state: EditorState, fence: SyntaxNode) {
  const [open, close] = fence.getChildren("CodeMark"), doc = state.doc;
  const opener = doc.lineAt(open!.from), closer = close ? doc.lineAt(close.from) : null;
  const lastBody = closer ? closer.number - 1 : doc.lineAt(fence.to).number;
  if (lastBody <= opener.number) return { changes: { from: open!.from, to: closer?.to ?? opener.to } };
  // The first body line moves onto the opener's prefix, replacing its own container prefix.
  const changes = [{ from: open!.from, to: codeStart(fence, doc.line(opener.number + 1)) }];
  if (closer) changes.push({ from: closer.from - 1, to: closer.to });
  return { changes };
}

/** @param state - Parsed source. @param range - Selection to wrap. @returns Fences around the selected lines, the caret on the body when it was empty. */
function wrap(state: EditorState, range: SelectionRange) {
  const doc = state.doc, first = doc.lineAt(range.from);
  const last = range.to > range.from && doc.lineAt(range.to).from === range.to ? doc.lineAt(range.to - 1) : doc.lineAt(range.to);
  const start = contentStart(state, first), prefix = state.sliceDoc(first.from, start);
  // New lines continue the container: quote markers repeat and list markers become equal-width indentation.
  const indent = prefix.replace(/(?:[-*+]|\d+[.)])(?=\s|$)/gu, marker => " ".repeat(marker.length));
  const body = state.sliceDoc(start, last.to), runs = body.match(/`+/gu) ?? [];
  const fence = "`".repeat(Math.max(3, ...runs.map(run => run.length + 1)));
  if (!body.trim()) {
    const insert = `${fence}\n${indent}\n${indent}${fence}`;
    return { changes: { from: start, to: last.to, insert }, selection: EditorSelection.cursor(start + fence.length + 1 + indent.length) };
  }
  return { changes: [{ from: start, insert: `${fence}\n${indent}` }, { from: last.to, insert: `\n${indent}${fence}` }] };
}

/**
 * Turns the selected lines into a fenced code block, or a fenced block back into text.
 * Both fences arrive in one edit, so a new opener never pairs with a later block's fence.
 * @returns A source command for one selection range.
 */
export function toggleCodeBlock(): MsfeCommand {
  return state => {
    if (state.selection.ranges.length !== 1) return null;
    const range = state.selection.main, fence = fencedAt(state, range.head);
    if (fence) return fence.getChildren("CodeMark").length ? unwrap(state, fence) : null;
    return wrap(state, range);
  };
}

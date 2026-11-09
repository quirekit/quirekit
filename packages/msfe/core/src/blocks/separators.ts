import type { EditorState } from "@quirekit/cm-state";
import type { MsfeSourceRange } from "../views/types";

/** Marks where the caret lands in an inserted payload, such as inside an empty code block; two markers select the text between them. It is never written. */
export const SOURCE_CARET = "\u0000";

/**
 * @param state - Current source. @param range - Insertion point or blank line being replaced.
 * @param payload - Exact Markdown, optionally holding one or two SOURCE_CARET markers. @param scope - Editable sibling flow.
 * @returns Minimal separators retaining existing neighboring whitespace, and the selection: between the markers, at the marker, or after the payload.
 */
export function sourceBlockInsertion(state: EditorState, range: MsfeSourceRange, payload: string, scope: MsfeSourceRange): { insert: string; offset: number; anchor: number; caret: number } {
  const parts = payload.split(SOURCE_CARET), markdown = parts.join("");
  const anchor = parts.length > 1 ? parts[0]!.length : markdown.length, head = parts.length > 2 ? anchor + parts[1]!.length : anchor;
  const before = state.sliceDoc(Math.max(0, range.from - 2), range.from), after = state.sliceDoc(range.to, Math.min(state.doc.length, range.to + 2));
  const leading = range.from === scope.from ? "" : "\n".repeat(2 - (before.match(/\n*$/u)?.[0].length ?? 0));
  const trailing = range.to === scope.to ? "" : "\n".repeat(2 - (after.match(/^\n*/u)?.[0].length ?? 0));
  const start = range.from + leading.length;
  return { insert: leading + markdown + trailing, offset: leading.length, anchor: start + anchor, caret: start + head };
}

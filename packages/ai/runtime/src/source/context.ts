import type { QuireAiSourceRange } from "@quirekit/ai-contract";
import { renderQuireAiSourceView } from "./view/render";
import type { QuireAiSourceSnapshot } from "./view/types";

/** Blocks of the view included in request context. */
const contextBlockLimit = 80;

/** Characters of selected text included in request context. */
const selectedTextLimit = 2_000;

/**
 * Describes the document and the user's selection for a new request, so short documents and
 * requests about the selection need no read first.
 * @param snapshot - Snapshot at request capture.
 * @param selection - Main selection.
 * @returns Model-facing context text.
 */
export function describeQuireAiSourceRequest(snapshot: QuireAiSourceSnapshot, selection: QuireAiSourceRange): string {
  const view = renderQuireAiSourceView(snapshot, { limit: contextBlockLimit });
  const more = view.next === undefined ? "" : `\n(first ${view.listed} of ${view.total} blocks; call document_read with from="${view.next}" for more)`;
  // Parents come before children, so the last block holding a position is the innermost.
  const containing = (pos: number) => snapshot.blocks.filter(block => block.from <= pos && pos <= block.to).at(-1)?.id;
  const start = containing(selection.from);
  const end = containing(selection.to);
  let described = "The cursor is outside the listed blocks.";
  if (start !== undefined && selection.from === selection.to) described = `The cursor is in ${start}; nothing is selected.`;
  else if (start !== undefined || end !== undefined) {
    const text = snapshot.text.slice(selection.from, selection.to);
    const clipped = text.length > selectedTextLimit ? `${text.slice(0, selectedTextLimit)}…` : text;
    const first = start ?? end!;
    described = `Selected ${first === end || end === undefined ? first : `${first} to ${end}`}: ${JSON.stringify(clipped)}`;
  }
  return `<document>\n${view.text}${more}\n</document>\n<selection>\n${described}\n</selection>`;
}

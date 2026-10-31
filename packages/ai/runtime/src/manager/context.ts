import type { QuireEditor } from "@quirekit/core";
import type { QuireAiBlockIdentity, QuireAiRegistry } from "./types";
import { renderQuireAiDocumentView } from "./view/render";

/** Blocks of the view included in request context. */
const contextBlockLimit = 80;

/** Characters of selected text included in request context. */
const selectedTextLimit = 2_000;

/**
 * Describes the document and the user's selection for a new request.
 *
 * The model can act on short documents and on the selection without reading
 * first; longer documents point to `document_read` for the rest.
 *
 * @param editor - Editor at request capture.
 * @param registry - Compiled facts.
 * @param identity - Block identity table.
 * @returns Model-facing context text.
 */
export function describeQuireAiRequest(editor: QuireEditor, registry: QuireAiRegistry, identity: QuireAiBlockIdentity): string {
  const view = renderQuireAiDocumentView(editor.state.doc, registry, identity, { limit: contextBlockLimit, stories: true });
  const more = view.next === undefined ? "" : `\n(first ${view.listed} of ${view.total} blocks; call document_read with from="${view.next}" for more)`;
  const { from, to, empty } = editor.state.pm.selection;
  // Containers are listed before their children, so the last containing block is the innermost.
  const containing = (pos: number) => view.blocks.filter(block => block.pos < pos && pos < block.pos + block.size).at(-1)?.id;
  const start = containing(from);
  const end = containing(to);
  let selection = "The cursor is outside the listed blocks.";
  if (start !== undefined && empty) selection = `The cursor is in ${start}; nothing is selected.`;
  else if (start !== undefined) {
    const text = editor.state.doc.textBetween(from, to, "\n", "￼");
    const clipped = text.length > selectedTextLimit ? `${text.slice(0, selectedTextLimit)}…` : text;
    selection = `Selected ${start === end || end === undefined ? start : `${start} to ${end}`}: ${JSON.stringify(clipped)}`;
  }
  return `<document>\n${view.text}${more}\n</document>\n<selection>\n${selection}\n</selection>`;
}

import { Type } from "typebox";
import type { QuireDocumentTool } from "../document-tools";
import { renderBlock, renderQuireAiSourceView } from "./view/render";
import type { QuireAiSourceSnapshots } from "./view/snapshot";
import type { QuireAiSourceView } from "./view/types";

const readParameters = Type.Object({
  from: Type.Optional(Type.String({ pattern: "^b[0-9]+$", description: "Block id to start at, from a previous read's `next`." })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, description: "Maximum blocks to list; default 200." })),
  find: Type.Optional(Type.String({ minLength: 1, description: "List only the blocks whose source contains this exact text, with the number of occurrences; that is what replace_text and replace_all change." })),
  block: Type.Optional(Type.String({ pattern: "^b[0-9]+$", description: "Read this one block in full, such as a long code block or table whose middle a listing leaves out." }))
}, { additionalProperties: false });

/** Core tool name for the structured document view. */
export const quireAiSourceReadToolName = "document_read" as const;

/**
 * Creates the read tool of a source document.
 * @param snapshots - Snapshot reader.
 * @param assertOpen - Throws when the document is closed or the call was cancelled.
 * @returns Read-only document tool.
 */
export function createQuireAiSourceReadTool(
  snapshots: QuireAiSourceSnapshots,
  assertOpen: (signal: AbortSignal) => void
): QuireDocumentTool<typeof readParameters, QuireAiSourceView> {
  const tool: QuireDocumentTool<typeof readParameters, QuireAiSourceView> = {
    name: quireAiSourceReadToolName,
    label: "Read Document",
    description: [
      "Lists the Markdown document block by block: `[b12] source`. The source is the exact Markdown of the block; lines after the first belong to the same block.",
      "Block ids stay the same across reads while the block exists.",
      "List items and the blocks inside them are indented beneath their parent, shown without the container's indentation.",
      "A block shown as a one-line summary, such as a diagram, holds data changed only through the commands document_edit lists.",
      "⟨批注 c1⟩ after a block names the comments on it; the comments section after the body lists each thread with its messages."
    ].join(" "),
    parameters: readParameters,
    effect: "read" as const,
    /**
     * @param input - Paging, search or one block.
     * @param context - Cancellation.
     * @returns View text as the model-visible summary.
     */
    async execute(input, context) {
      assertOpen(context.signal);
      const snapshot = snapshots.read();
      if (input.block !== undefined) {
        const block = snapshot.blocks.find(item => item.id === input.block);
        if (block === undefined) return { value: { text: "", listed: 0, total: snapshot.blocks.length, occurrences: 0 }, summary: `Block ${input.block} no longer exists; read the document again.` };
        const text = renderBlock(block, true);
        return { value: { text, listed: 1, total: snapshot.blocks.length, occurrences: 0 }, summary: text };
      }
      const render = (from: string | undefined) => renderQuireAiSourceView(snapshot, { from, limit: input.limit ?? 200, find: input.find });
      let restarted = false;
      let view: QuireAiSourceView;
      try {
        view = render(input.from);
      } catch (error) {
        // A `from` block deleted since the last read: list from the start instead of failing the read.
        if (!(error instanceof RangeError) || input.from === undefined) throw error;
        view = render(undefined);
        restarted = true;
      }
      const scope = input.find === undefined ? "blocks" : `blocks containing ${JSON.stringify(input.find)}, ${view.occurrences} occurrence(s) in all`;
      const footer = view.next === undefined
        ? `(${view.listed} of ${view.total} ${scope})`
        : `(${view.listed} of ${view.total} ${scope}; continue with from="${view.next}")`;
      const note = restarted ? `(block ${input.from} no longer exists; listed from the start)\n` : "";
      return { value: view, summary: `${note}${view.text}\n${footer}` };
    }
  };
  return Object.freeze(tool);
}

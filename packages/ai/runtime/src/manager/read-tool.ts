import type { QuireAiLayoutPort } from "@quirekit/ai-contract";
import { Type } from "typebox";
import type { QuireDocumentTool } from "../document-tools";
import type { QuireAiToolHost } from "../tool-host";
import type { QuireAiManager } from "./types";
import { normalizeQuireAiSearchText } from "./edit/search";
import { renderQuireAiDocumentView } from "./view/render";
import type { QuireAiDocumentView } from "./view/types";
import { readQuireAiItems, failedQuireAiItemRead } from "./view/items/read";

const readParameters = Type.Object({
  items: Type.Optional(Type.Object({
    block: Type.String({ pattern: "^b[0-9]+$", description: "Read internal items of this exact block instead of listing document blocks." }),
    offset: Type.Optional(Type.Integer({ minimum: 0, description: "Offset in filtered items; default 0." })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, description: "Maximum items; default 40, also bounded by output length." })),
    ids: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 200 }), { minItems: 1, maxItems: 100, description: "Exact native item IDs." })),
    find: Type.Optional(Type.String({ minLength: 1, maxLength: 500, description: "Case-sensitive substring of the full internal item label; applied before paging." }))
  }, { additionalProperties: false })),
  from: Type.Optional(Type.String({ pattern: "^b[0-9]+$", description: "Block id to start at, from a previous read's `next`." })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, description: "Maximum blocks to list; default 200." })),
  stories: Type.Optional(Type.Boolean({ description: "Include headers, footers and other stories; default true." })),
  find: Type.Optional(Type.String({ minLength: 1, description: "List only the blocks containing this exact text, anywhere in the document, including blocks whose objects mention it, such as a diagram's title or nodes; occurrences count the text only, which is what replace_text and replace_all change." }))
}, { additionalProperties: false });

/** Core tool name for the structured document view. */
export const QUIRE_AI_DOCUMENT_READ_TOOL_NAME = "document_read" as const;

/**
 * Creates the core structured read tool.
 *
 * @param manager - AI manager supplying facts and block identities.
 * @param host - Guarded read access.
 * @returns Read-only document tool.
 */
export function createQuireAiReadTool(
  manager: QuireAiManager,
  host: QuireAiToolHost,
  layout?: QuireAiLayoutPort
): QuireDocumentTool<typeof readParameters, QuireAiDocumentView> {
  const tool: QuireDocumentTool<typeof readParameters, QuireAiDocumentView> = {
    name: QUIRE_AI_DOCUMENT_READ_TOOL_NAME,
    label: "Read Document",
    description: [
      "Lists the document block by block: `[b12] {name:value} text`.",
      "Block ids stay the same across reads while the block exists.",
      "For blocks exposing internal items, use items:{block,offset?,limit?,ids?,find?} to read nodes beyond their short summary. Keep filters when continuing with the returned offset. Item IDs target described commands; they are not document block IDs. Do not combine items with document paging or search. Truncated rows are explicitly marked.",
      "Braces hold paragraph formats; **bold**, *italic* and [text]{name:value} mark character formats; <br/> is a line break inside a paragraph.",
      "⟦text⟧ is the content of an embedded field such as a content control; change it with replace_text and keep the field.",
      "Sections start with `## `: a read from the start opens with 文档设置 (page setup, document fonts and styles, changed with the matching actions), then the body, then headers, footers and other stories.",
      "Table cells are listed indented beneath their table with a (row,column) caption.",
      "`—— 第 N 页 ——` lines show where laid-out pages begin; one noting how little of the page before was used means content moved on, such as a heading kept with the next paragraph or a table that does not split.",
      "{deleted:\"pending review\"} marks a block already deleted as a tracked change: it stays visible until someone reviews it and needs no more editing."
    ].join(" "),
    parameters: readParameters,
    effect: "read" as const,
    /**
     * Renders the requested window of the view.
     * @param input - Paging and scope.
     * @param context - Cancellation.
     * @returns View text as the model-visible summary.
     */
    async execute(input, context) {
      if (input.items !== undefined) {
        const mixed = input.from !== undefined || input.find !== undefined || input.limit !== undefined || input.stories !== undefined;
        const view = host.read(context.signal, editor => mixed ? failedQuireAiItemRead("Do not combine items with document paging or search.") : readQuireAiItems(editor.state.doc, manager, input.items!));
        return { value: view, summary: view.text };
      }
      const render = (from: string | undefined) => host.read(context.signal, editor => renderQuireAiDocumentView(
        editor.state.doc, manager.registry, manager.identity,
        { from, limit: input.limit ?? 200, stories: input.stories ?? true, find: input.find === undefined ? undefined : normalizeQuireAiSearchText(input.find),
          pages: layout?.pages(editor.state.doc) ?? undefined }
      ));
      let restarted = false;
      let view: QuireAiDocumentView;
      try {
        view = render(input.from);
      } catch (error) {
        // A `from` block deleted since the last read: list from the start instead of failing the read.
        if (!(error instanceof RangeError) || input.from === undefined) throw error;
        view = render(undefined);
        restarted = true;
      }
      const objects = view.inObjects ? `; ${view.inObjects} of them only inside an object such as a picture or diagram, which replace_text cannot change` : "";
      const scope = input.find === undefined ? "blocks" : `blocks containing ${JSON.stringify(input.find)}, ${view.occurrences} occurrence(s) in all${objects}`;
      const footer = view.next === undefined
        ? `(${view.listed} of ${view.total} ${scope})`
        : `(${view.listed} of ${view.total} ${scope}; continue with from="${view.next}")`;
      const note = restarted ? `(block ${input.from} no longer exists; listed from the start)\n` : "";
      return { value: view, summary: `${note}${view.text}\n${footer}` };
    }
  };
  return Object.freeze(tool);
}
